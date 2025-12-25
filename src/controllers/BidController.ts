import { Request, Response, NextFunction } from 'express';
import { BidService } from '../services/bid.service';
import { ApiResponse } from '../utils/helpers';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';
import Bid from '../database/models/Bid';
import Auction from '../database/models/Auction';
import User from '../database/models/User';

export class BidController {
  // Place a bid
  public static async placeBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const { auctionId } = req.params;
      const { amount, isAutoBid = false, maxAutoBidAmount } = req.body;
      const bidderId = (req as any).user.id;

      // Validate user role
      if ((req as any).user.role !== 'bidder') {
        throw new ApiResponse(403, 'Only bidders can place bids');
      }

      const bidResult = await BidService.placeBid(
        auctionId, 
        bidderId, 
        parseFloat(amount),
        isAutoBid,
        maxAutoBidAmount ? parseFloat(maxAutoBidAmount) : null
      );

      logger.info(`Bid placed: ${amount} on auction ${auctionId} by user ${bidderId}`);

      res.json(new ApiResponse(200, 'Bid placed successfully', {
        bidId: bidResult.bidId,
        amount: bidResult.amount,
        auctionId: bidResult.auctionId,
        isWinning: bidResult.isWinning,
        previousHighestBidderId: bidResult.previousHighestBidderId
      }));
    } catch (error) {
      next(error);
    }
  }

  // Get auction bids
  public static async getAuctionBids(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { auctionId } = req.params;
      const { limit = 20, offset = 0, sortBy = 'createdAt', sortOrder = 'DESC' } = req.query;

      const bids = await Bid.findAll({
        where: { auctionId },
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        order: [[sortBy as string, sortOrder as string]],
        include: [
          {
            model: User,
            as: 'bidder',
            attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture']
          }
        ]
      });

      const total = await Bid.count({ where: { auctionId } });

      res.json(new ApiResponse(200, 'Bids fetched successfully', {
        bids,
        total,
        page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }));
    } catch (error) {
      next(error);
    }
  }

  // Get user's bids
  public static async getUserBids(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { status, limit = 20, offset = 0 } = req.query;

      const whereClause: any = { bidderId: userId };
      if (status) whereClause.status = status;

      const bids = await Bid.findAll({
        where: whereClause,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['id', 'title', 'category', 'status', 'currentHighestBid', 'timing'],
            include: [
              {
                model: User,
                as: 'company',
                attributes: ['id', 'firstName', 'lastName', 'profilePicture']
              }
            ]
          }
        ]
      });

      const total = await Bid.count({ where: whereClause });

      // Calculate stats
      const stats = {
        totalBids: await Bid.count({ where: { bidderId: userId } }),
        activeBids: await Bid.count({ where: { bidderId: userId, status: 'active' } }),
        winningBids: await Bid.count({ where: { bidderId: userId, status: 'winning' } }),
        totalAmount: await Bid.sum('amount', { where: { bidderId: userId } })
      };

      res.json(new ApiResponse(200, 'User bids fetched successfully', {
        bids,
        total,
        stats,
        page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }));
    } catch (error) {
      next(error);
    }
  }

  // Get bid details
  public static async getBidDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bidId } = req.params;
      const userId = (req as any).user.id;

      const bid = await Bid.findByPk(bidId, {
        include: [
          {
            model: Auction,
            as: 'auction',
            include: [
              {
                model: User,
                as: 'company',
                attributes: ['id', 'firstName', 'lastName', 'profilePicture']
              }
            ]
          },
          {
            model: User,
            as: 'bidder',
            attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture']
          }
        ]
      });

      if (!bid) {
        throw new ApiResponse(404, 'Bid not found');
      }

      // Check if user owns the bid or is admin/auction owner
      if (bid.bidderId !== userId && (req as any).user.role !== 'admin') {
        const auction = await Auction.findByPk(bid.auctionId);
        if (!auction || auction.companyId !== userId) {
          throw new ApiResponse(403, 'Not authorized to view this bid');
        }
      }

      res.json(new ApiResponse(200, 'Bid details fetched successfully', bid));
    } catch (error) {
      next(error);
    }
  }

  // Withdraw bid
  public static async withdrawBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bidId } = req.params;
      const userId = (req as any).user.id;

      const bid = await Bid.findByPk(bidId);
      
      if (!bid) {
        throw new ApiResponse(404, 'Bid not found');
      }

      // Check ownership
      if (bid.bidderId !== userId) {
        throw new ApiResponse(403, 'Not authorized to withdraw this bid');
      }

      // Check if bid can be withdrawn
      if (bid.status !== 'active') {
        throw new ApiResponse(400, 'Only active bids can be withdrawn');
      }

      // Get auction
      const auction = await Auction.findByPk(bid.auctionId);
      if (!auction) {
        throw new ApiResponse(404, 'Auction not found');
      }

      // Check auction status
      if (auction.status !== 'live') {
        throw new ApiResponse(400, 'Cannot withdraw bid from non-live auction');
      }

      // Update bid status
      bid.status = 'withdrawn';
      await bid.save();

      // If this was the highest bid, find next highest bid
      if (auction.currentHighestBidderId === userId && auction.currentHighestBid === bid.amount) {
        const nextHighestBid = await Bid.findOne({
          where: {
            auctionId: auction.id,
            bidderId: { $ne: userId },
            status: 'active'
          },
          order: [['amount', 'DESC']]
        });

        if (nextHighestBid) {
          auction.currentHighestBid = nextHighestBid.amount;
          auction.currentHighestBidderId = nextHighestBid.bidderId;
        } else {
          auction.currentHighestBid = auction.auctionConfig?.startingBid || 0;
          auction.currentHighestBidderId = null;
        }
        
        await auction.save();
      }

      logger.info(`Bid withdrawn: ${bidId} by user ${userId}`);

      res.json(new ApiResponse(200, 'Bid withdrawn successfully'));
    } catch (error) {
      next(error);
    }
  }

  // Update auto-bid settings
  public static async updateAutoBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { auctionId } = req.params;
      const { maxAmount, increment } = req.body;
      const userId = (req as any).user.id;

      // Validate user role
      if ((req as any).user.role !== 'bidder') {
        throw new ApiResponse(403, 'Only bidders can set auto-bid');
      }

      // Get auction
      const auction = await Auction.findByPk(auctionId);
      if (!auction) {
        throw new ApiResponse(404, 'Auction not found');
      }

      if (auction.status !== 'live') {
        throw new ApiResponse(400, 'Cannot set auto-bid on non-live auction');
      }

      // Get or create auto-bid settings
      // In a real app, you might have an AutoBid model
      const autoBidSettings = {
        auctionId,
        userId,
        maxAmount: parseFloat(maxAmount),
        increment: increment ? parseFloat(increment) : null,
        active: true,
        updatedAt: new Date()
      };

      // Store in Redis for quick access
      // await redisClient.setEx(`auto_bid:${auctionId}:${userId}`, 3600, JSON.stringify(autoBidSettings));

      logger.info(`Auto-bid settings updated for auction ${auctionId} by user ${userId}`);

      res.json(new ApiResponse(200, 'Auto-bid settings updated successfully', autoBidSettings));
    } catch (error) {
      next(error);
    }
  }

  // Get bid analytics
  public static async getBidAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const { startDate, endDate } = req.query;

      const whereClause: any = { bidderId: userId };
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string)
        };
      }

      // Get bid statistics
      const totalBids = await Bid.count({ where: whereClause });
      const totalAmount = await Bid.sum('amount', { where: whereClause }) || 0;
      const winningBids = await Bid.count({ where: { ...whereClause, status: 'winning' } });
      const activeBids = await Bid.count({ where: { ...whereClause, status: 'active' } });

      // Get bids by category
      const bidsByCategory = await Bid.findAll({
        where: whereClause,
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['category']
          }
        ]
      });

      const categoryStats: any = {};
      bidsByCategory.forEach(bid => {
        const category = (bid as any).auction?.category || 'unknown';
        categoryStats[category] = (categoryStats[category] || 0) + 1;
      });

      // Get recent bidding activity
      const recentBids = await Bid.findAll({
        where: whereClause,
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: Auction,
            as: 'auction',
            attributes: ['id', 'title', 'category']
          }
        ]
      });

      const analytics = {
        totalBids,
        totalAmount,
        winningBids,
        activeBids,
        successRate: totalBids > 0 ? Math.round((winningBids / totalBids) * 100) : 0,
        averageBid: totalBids > 0 ? totalAmount / totalBids : 0,
        categoryStats,
        recentBids,
        timePeriod: {
          startDate: startDate || 'all time',
          endDate: endDate || 'now'
        }
      };

      res.json(new ApiResponse(200, 'Bid analytics fetched successfully', analytics));
    } catch (error) {
      next(error);
    }
  }

  // Get highest bidders for auction
  public static async getTopBidders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { auctionId } = req.params;
      const { limit = 10 } = req.query;

      const topBids = await Bid.findAll({
        where: { auctionId },
        attributes: [
          'bidderId',
          [sequelize.fn('MAX', sequelize.col('amount')), 'maxBid']
        ],
        group: ['bidderId'],
        order: [[sequelize.literal('maxBid'), 'DESC']],
        limit: parseInt(limit as string),
        include: [
          {
            model: User,
            as: 'bidder',
            attributes: ['id', 'firstName', 'lastName', 'profilePicture']
          }
        ]
      });

      res.json(new ApiResponse(200, 'Top bidders fetched successfully', topBids));
    } catch (error) {
      next(error);
    }
  }
}