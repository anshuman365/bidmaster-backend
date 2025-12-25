import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { auctionService } from '../services/auction.service';
import { bidService } from '../services/bid.service';
import User from '../database/models/User';
import Auction from '../database/models/Auction';
import { logger } from '../utils/logger';
import { socketAuth } from '../middleware/auth.middleware';
import redisClient from '../config/redis';

// Interface for WebSocket data
interface SocketUser {
  id: string;
  email: string;
  role: 'admin' | 'company' | 'bidder';
  firstName: string;
  lastName: string;
  companyId?: string | null;
}

interface JoinAuctionData {
  auctionId: string;
}

interface PlaceBidData {
  auctionId: string;
  amount: number;
}

interface AuctionRoomInfo {
  users: Map<string, SocketUser>;
  auction: any;
  bidHistory: Array<{
    amount: number;
    bidderId: string;
    bidderName: string;
    timestamp: Date;
  }>;
}

// Store active auction rooms
const activeAuctionRooms = new Map<string, AuctionRoomInfo>();

export const setupAuctionSocket = (io: Server): void => {
  // Authentication middleware for WebSocket connections
  io.use(socketAuth);

  // Connection event
  io.on('connection', (socket: Socket) => {
    const user = socket.user as SocketUser;
    
    logger.info(`Socket connected: ${user.id} - ${user.email} - ${socket.id}`);

    // Track user activity
    trackUserActivity(user.id, socket.id);

    // Join user to their personal room for private messages
    socket.join(`user:${user.id}`);

    // Handle joining an auction room
    socket.on('JOIN_AUCTION', async (data: JoinAuctionData) => {
      try {
        const { auctionId } = data;

        // Validate auction
        const auction = await Auction.findByPk(auctionId);
        if (!auction) {
          socket.emit('ERROR', { message: 'Auction not found' });
          return;
        }

        // Check if auction is live
        if (!auction.isLive()) {
          socket.emit('ERROR', { message: 'Auction is not live' });
          return;
        }

        // Join the auction room
        socket.join(`auction:${auctionId}`);

        // Initialize or update room info
        if (!activeAuctionRooms.has(auctionId)) {
          activeAuctionRooms.set(auctionId, {
            users: new Map(),
            auction: auction.toJSON(),
            bidHistory: []
          });
        }

        const roomInfo = activeAuctionRooms.get(auctionId)!;
        roomInfo.users.set(socket.id, user);

        // Send welcome message with auction details
        socket.emit('AUCTION_JOINED', {
          auction: auction.toJSON(),
          currentHighestBid: auction.currentHighestBid,
          currentHighestBidderId: auction.currentHighestBidderId,
          totalBids: auction.totalBids,
          roomUsers: Array.from(roomInfo.users.values()).length,
          bidHistory: roomInfo.bidHistory.slice(-20) // Last 20 bids
        });

        // Notify others in the room
        socket.to(`auction:${auctionId}`).emit('USER_JOINED', {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          totalUsers: roomInfo.users.size
        });

        logger.info(`User ${user.email} joined auction: ${auctionId}`);
      } catch (error: any) {
        logger.error('Error joining auction room:', error);
        socket.emit('ERROR', { message: 'Failed to join auction' });
      }
    });

    // Handle placing a bid
    socket.on('PLACE_BID', async (data: PlaceBidData) => {
      try {
        const { auctionId, amount } = data;

        // Check if user is in the auction room
        if (!socket.rooms.has(`auction:${auctionId}`)) {
          socket.emit('BID_ERROR', { message: 'You must join the auction first' });
          return;
        }

        // Check user role
        if (user.role !== 'bidder') {
          socket.emit('BID_ERROR', { message: 'Only bidders can place bids' });
          return;
        }

        // Place bid using service
        const bidResult = await bidService.placeBid(auctionId, user.id, amount);

        // Get updated auction
        const auction = await Auction.findByPk(auctionId);
        if (!auction) {
          socket.emit('BID_ERROR', { message: 'Auction not found' });
          return;
        }

        // Create bid record
        const bidRecord = {
          amount: bidResult.amount,
          bidderId: bidResult.bidderId,
          bidderName: `${user.firstName} ${user.lastName}`,
          timestamp: new Date()
        };

        // Update room bid history
        const roomInfo = activeAuctionRooms.get(auctionId);
        if (roomInfo) {
          roomInfo.bidHistory.push(bidRecord);
          roomInfo.auction = auction.toJSON();
        }

        // Broadcast new bid to all users in the auction room
        io.to(`auction:${auctionId}`).emit('NEW_BID', {
          auctionId,
          bid: bidRecord,
          auction: {
            currentHighestBid: auction.currentHighestBid,
            currentHighestBidderId: auction.currentHighestBidderId,
            totalBids: auction.totalBids,
            totalBidders: auction.totalBidders
          }
        });

        // Send notification to previous highest bidder if different
        if (bidResult.previousHighestBidderId && 
            bidResult.previousHighestBidderId !== user.id) {
          io.to(`user:${bidResult.previousHighestBidderId}`).emit('OUTBID', {
            auctionId,
            auctionTitle: auction.title,
            newBid: amount,
            outbidBy: `${user.firstName} ${user.lastName}`
          });
        }

        // Notify auction owner
        io.to(`user:${auction.companyId}`).emit('AUCTION_BID_RECEIVED', {
          auctionId,
          auctionTitle: auction.title,
          bidAmount: amount,
          bidderName: `${user.firstName} ${user.lastName}`
        });

        logger.info(`Bid placed by ${user.email}: ${amount} on auction ${auctionId}`);
      } catch (error: any) {
        logger.error('Error placing bid:', error);
        socket.emit('BID_ERROR', { 
          message: error.message || 'Failed to place bid' 
        });
      }
    });

    // Handle leaving an auction room
    socket.on('LEAVE_AUCTION', (data: { auctionId: string }) => {
      const { auctionId } = data;
      
      socket.leave(`auction:${auctionId}`);
      
      const roomInfo = activeAuctionRooms.get(auctionId);
      if (roomInfo) {
        roomInfo.users.delete(socket.id);
        
        // Remove room if empty
        if (roomInfo.users.size === 0) {
          activeAuctionRooms.delete(auctionId);
        } else {
          // Notify others
          socket.to(`auction:${auctionId}`).emit('USER_LEFT', {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            totalUsers: roomInfo.users.size
          });
        }
      }

      logger.info(`User ${user.email} left auction: ${auctionId}`);
    });

    // Handle auction timer updates
    socket.on('GET_AUCTION_TIMER', async (data: { auctionId: string }) => {
      try {
        const { auctionId } = data;
        const auction = await Auction.findByPk(auctionId);
        
        if (!auction || !auction.timing?.biddingEndsAt) {
          socket.emit('AUCTION_TIMER', { timeRemaining: 0 });
          return;
        }

        const endTime = new Date(auction.timing.biddingEndsAt).getTime();
        const now = Date.now();
        const timeRemaining = Math.max(0, endTime - now);

        socket.emit('AUCTION_TIMER', {
          timeRemaining,
          formattedTime: formatTimeRemaining(timeRemaining),
          isEnded: timeRemaining === 0
        });
      } catch (error) {
        logger.error('Error getting auction timer:', error);
      }
    });

    // Handle chat messages
    socket.on('SEND_MESSAGE', (data: { 
      auctionId: string; 
      message: string;
      type?: 'text' | 'image' | 'system';
    }) => {
      const { auctionId, message, type = 'text' } = data;
      
      // Check if user is in the auction room
      if (!socket.rooms.has(`auction:${auctionId}`)) {
        socket.emit('CHAT_ERROR', { message: 'You must join the auction first' });
        return;
      }

      // Validate message
      if (!message.trim() || message.length > 1000) {
        socket.emit('CHAT_ERROR', { 
          message: 'Message must be between 1 and 1000 characters' 
        });
        return;
      }

      const chatMessage = {
        id: `msg_${Date.now()}`,
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        userRole: user.role,
        message: message.trim(),
        type,
        timestamp: new Date()
      };

      // Broadcast message to auction room
      io.to(`auction:${auctionId}`).emit('NEW_MESSAGE', chatMessage);

      // Log chat activity
      logger.debug(`Chat message from ${user.email} in auction ${auctionId}: ${message}`);
    });

    // Handle auction status updates
    socket.on('GET_AUCTION_STATUS', async (data: { auctionId: string }) => {
      try {
        const { auctionId } = data;
        const auction = await Auction.findByPk(auctionId);
        
        if (!auction) {
          socket.emit('AUCTION_STATUS', { error: 'Auction not found' });
          return;
        }

        socket.emit('AUCTION_STATUS', {
          status: auction.status,
          isLive: auction.isLive(),
          currentHighestBid: auction.currentHighestBid,
          currentHighestBidderId: auction.currentHighestBidderId,
          totalBids: auction.totalBids,
          totalBidders: auction.totalBidders,
          totalViews: auction.totalViews,
          totalWatches: auction.totalWatches
        });
      } catch (error) {
        logger.error('Error getting auction status:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      // Remove user from all auction rooms
      activeAuctionRooms.forEach((roomInfo, auctionId) => {
        if (roomInfo.users.has(socket.id)) {
          roomInfo.users.delete(socket.id);
          
          // Notify others in the room
          socket.to(`auction:${auctionId}`).emit('USER_LEFT', {
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            totalUsers: roomInfo.users.size
          });

          // Remove room if empty
          if (roomInfo.users.size === 0) {
            activeAuctionRooms.delete(auctionId);
          }
        }
      });

      // Remove user activity tracking
      removeUserActivity(user.id, socket.id);

      logger.info(`Socket disconnected: ${user.id} - ${user.email} - ${socket.id}`);
    });

    // Handle ping/pong for connection health
    socket.on('ping', (cb) => {
      if (typeof cb === 'function') {
        cb();
      }
    });

    // Handle error
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
    });
  });

  // Periodically check and update auction status
  setInterval(async () => {
    try {
      // Get all live auctions
      const liveAuctions = await Auction.findAll({
        where: { status: 'live' }
      });

      for (const auction of liveAuctions) {
        const auctionId = auction.id;
        
        // Check if auction should end
        if (!auction.isLive()) {
          // Update auction status
          auction.status = 'ended';
          await auction.save();

          // Notify all users in the auction room
          const roomInfo = activeAuctionRooms.get(auctionId);
          if (roomInfo) {
            io.to(`auction:${auctionId}`).emit('AUCTION_ENDED', {
              auctionId,
              winnerId: auction.winnerId,
              finalAmount: auction.finalAmount,
              message: 'Auction has ended'
            });

            // Clear room after auction ends
            setTimeout(() => {
              activeAuctionRooms.delete(auctionId);
            }, 30000); // 30 seconds delay
          }

          // Notify winner
          if (auction.winnerId) {
            io.to(`user:${auction.winnerId}`).emit('AUCTION_WON', {
              auctionId,
              auctionTitle: auction.title,
              winningAmount: auction.finalAmount
            });
          }
        } else {
          // Send timer updates to all users in the room
          const endTime = new Date(auction.timing.biddingEndsAt).getTime();
          const timeRemaining = Math.max(0, endTime - Date.now());
          
          // Only send updates if less than 5 minutes remain
          if (timeRemaining <= 5 * 60 * 1000) {
            io.to(`auction:${auctionId}`).emit('TIMER_UPDATE', {
              auctionId,
              timeRemaining,
              formattedTime: formatTimeRemaining(timeRemaining)
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error in auction status check:', error);
    }
  }, 10000); // Check every 10 seconds

  logger.info('WebSocket server initialized for auction functionality');
};

// Helper function to format time remaining
function formatTimeRemaining(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Track user activity
async function trackUserActivity(userId: string, socketId: string): Promise<void> {
  try {
    const key = `user:active:${userId}`;
    await redisClient.sAdd(key, socketId);
    await redisClient.expire(key, 3600); // Expire after 1 hour
  } catch (error) {
    logger.error('Error tracking user activity:', error);
  }
}

// Remove user activity tracking
async function removeUserActivity(userId: string, socketId: string): Promise<void> {
  try {
    const key = `user:active:${userId}`;
    await redisClient.sRem(key, socketId);
  } catch (error) {
    logger.error('Error removing user activity:', error);
  }
}

// Get active users in an auction room
export function getActiveUsersInAuction(auctionId: string): SocketUser[] {
  const roomInfo = activeAuctionRooms.get(auctionId);
  if (!roomInfo) return [];
  
  return Array.from(roomInfo.users.values());
}

// Get all active auction rooms
export function getActiveAuctionRooms(): Map<string, AuctionRoomInfo> {
  return activeAuctionRooms;
}

// Clean up inactive rooms
export function cleanupInactiveRooms(): void {
  const now = Date.now();
  activeAuctionRooms.forEach((roomInfo, auctionId) => {
    // Remove room if no activity in last 30 minutes
    if (roomInfo.users.size === 0) {
      activeAuctionRooms.delete(auctionId);
    }
  });
}