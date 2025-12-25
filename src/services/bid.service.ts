import Auction from '../database/models/Auction';
import User from '../database/models/User';
import { ApiResponse } from '../utils/helpers';
import sequelize from '../config/database';
import { logger } from '../utils/logger';

export class BidService {
  public static async placeBid(
    auctionId: string, 
    bidderId: string, 
    amount: number
  ): Promise<{
    amount: number;
    bidderId: string;
    previousHighestBidderId: string | null;
    auctionTotalBids: number;
  }> {
    const transaction = await sequelize.transaction();
    
    try {
      // Get auction with lock to prevent race conditions
      const auction = await Auction.findByPk(auctionId, { 
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      
      if (!auction) {
        throw new ApiResponse(404, 'Auction not found');
      }

      // Check auction status
      if (!auction.isLive()) {
        throw new ApiResponse(400, 'Auction is not live');
      }

      // Check if bidder is the auction owner
      if (auction.companyId === bidderId) {
        throw new ApiResponse(400, 'Cannot bid on your own auction');
      }

      // Get bidder
      const bidder = await User.findByPk(bidderId, { transaction });
      if (!bidder) {
        throw new ApiResponse(404, 'Bidder not found');
      }

      // Check if bidder is verified
      if (!bidder.isVerified) {
        throw new ApiResponse(403, 'Please verify your account before bidding');
      }

      const minBid = auction.getMinNextBid();
      
      if (amount < minBid) {
        throw new ApiResponse(400, `Minimum bid required is ${minBid}`);
      }

      const previousHighestBidderId = auction.currentHighestBidderId;

      // Update auction with new bid
      auction.currentHighestBid = amount;
      auction.currentHighestBidderId = bidderId;
      auction.totalBids += 1;

      // Update total bidders count if this is a new bidder
      if (previousHighestBidderId !== bidderId) {
        auction.totalBidders += 1;
      }

      // Check if auction should be extended (if auto-extend is enabled)
      if (auction.auctionConfig?.autoExtend) {
        const biddingEndsAt = new Date(auction.timing.biddingEndsAt);
        const now = new Date();
        const timeLeft = biddingEndsAt.getTime() - now.getTime();
        
        // If less than extension time left, extend the auction
        if (timeLeft < (auction.auctionConfig.extensionTime * 1000)) {
          const extensions = auction.metadata?.extensions || 0;
          
          if (extensions < (auction.auctionConfig.maxExtensions || 3)) {
            const newEndTime = new Date(now.getTime() + (auction.auctionConfig.extensionTime * 1000));
            auction.timing.biddingEndsAt = newEndTime;
            auction.metadata = {
              ...auction.metadata,
              extensions: extensions + 1,
              lastExtendedAt: now
            };
            
            logger.info(`Auction ${auctionId} extended to ${newEndTime}`);
          }
        }
      }

      await auction.save({ transaction });

      // Record the bid (you might want to create a Bid model for this)
      // For now, we'll just log it
      logger.info(`Bid placed: ${amount} on auction ${auctionId} by ${bidder.email}`);

      await transaction.commit();

      return {
        amount,
        bidderId,
        previousHighestBidderId,
        auctionTotalBids: auction.totalBids
      };
    } catch (error) {
      await transaction.rollback();
      
      if (error instanceof ApiResponse) {
        throw error;
      }
      
      logger.error('Error placing bid:', error);
      throw new ApiResponse(500, 'Failed to place bid');
    }
  }

  public static async getAuctionBids(auctionId: string, filters: any = {}): Promise<any[]> {
    try {
      const auction = await Auction.findByPk(auctionId);
      
      if (!auction) {
        throw new ApiResponse(404, 'Auction not found');
      }

      // In a real implementation, you would query a Bid model
      // For now, return mock data or implement with a Bid model
      return [
        {
          id: 'bid_1',
          amount: auction.currentHighestBid,
          bidderId: auction.currentHighestBidderId,
          timestamp: new Date()
        }
      ];
    } catch (error) {
      if (error instanceof ApiResponse) {
        throw error;
      }
      logger.error('Error getting auction bids:', error);
      throw new ApiResponse(500, 'Failed to fetch bids');
    }
  }

  public static async getUserBids(userId: string, filters: any = {}): Promise<any[]> {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new ApiResponse(404, 'User not found');
      }

      // Find auctions where user is the highest bidder
      const auctions = await Auction.findAll({
        where: {
          currentHighestBidderId: userId
        },
        include: [
          {
            association: 'company',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ],
        order: [['updatedAt', 'DESC']]
      });

      return auctions.map(auction => ({
        auctionId: auction.id,
        auctionTitle: auction.title,
        amount: auction.currentHighestBid,
        status: auction.status,
        bidPlacedAt: auction.updatedAt,
        auction: auction.toJSON()
      }));
    } catch (error) {
      if (error instanceof ApiResponse) {
        throw error;
      }
      logger.error('Error getting user bids:', error);
      throw new ApiResponse(500, 'Failed to fetch user bids');
    }
  }
}

export const bidService = BidService;