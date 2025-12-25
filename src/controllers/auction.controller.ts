import { Request, Response, NextFunction } from 'express';
import { auctionService } from '../services/auction.service';
import { bidService } from '../services/bid.service';
import { ApiResponse } from '../utils/helpers';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';

export class AuctionController {
  // Get all auctions
  public static async getAuctions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = req.query;
      const result = await auctionService.getAuctions(filters);
      
      res.json(
        new ApiResponse(200, 'Auctions fetched successfully', {
          auctions: result.auctions,
          total: result.total,
          page: parseInt(filters.offset as string) / parseInt(filters.limit as string || '10') + 1 || 1,
          totalPages: Math.ceil(result.total / parseInt(filters.limit as string || '10'))
        })
      );
    } catch (error) {
      next(error);
    }
  }

  // Get single auction
  public static async getAuction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const auction = await auctionService.getAuctionById(id);
      
      res.json(new ApiResponse(200, 'Auction fetched successfully', auction));
    } catch (error) {
      next(error);
    }
  }

  // Create new auction
  public static async createAuction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const user = (req as any).user;
      const auctionData = req.body;
      
      // Ensure company users can only create auctions for their company
      if (user.role === 'company') {
        auctionData.companyId = user.id;
      } else if (user.role === 'admin' && !auctionData.companyId) {
        throw new ApiResponse(400, 'Company ID is required for admin users');
      }

      const auction = await auctionService.createAuction(auctionData, auctionData.companyId);
      
      logger.info(`Auction created: ${auction.title} by user ${user.id}`);
      
      res.status(201).json(
        new ApiResponse(201, 'Auction created successfully', auction)
      );
    } catch (error) {
      next(error);
    }
  }

  // Update auction
  public static async updateAuction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const { id } = req.params;
      const user = (req as any).user;
      const updateData = req.body;

      // Remove fields that shouldn't be updated
      delete updateData.id;
      delete updateData.companyId;
      delete updateData.currentHighestBid;
      delete updateData.currentHighestBidderId;
      delete updateData.totalBids;

      const auction = await auctionService.updateAuction(
        id, 
        updateData, 
        user.role === 'admin' ? undefined : user.id
      );
      
      res.json(new ApiResponse(200, 'Auction updated successfully', auction));
    } catch (error) {
      next(error);
    }
  }

  // Delete auction
  public static async deleteAuction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      
      await auctionService.deleteAuction(
        id, 
        user.role === 'admin' ? undefined : user.id
      );
      
      res.json(new ApiResponse(200, 'Auction deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  // Start auction
  public static async startAuction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      
      const auction = await auctionService.startAuction(id, user.id);
      
      res.json(new ApiResponse(200, 'Auction started successfully', auction));
    } catch (error) {
      next(error);
    }
  }

  // Place bid
  public static async placeBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const { id } = req.params;
      const { amount } = req.body;
      const user = (req as any).user;

      // Validate user role
      if (user.role !== 'bidder') {
        throw new ApiResponse(403, 'Only bidders can place bids');
      }

      const bidResult = await bidService.placeBid(id, user.id, parseFloat(amount));
      
      logger.info(`Bid placed: ${amount} on auction ${id} by user ${user.id}`);
      
      res.json(new ApiResponse(200, 'Bid placed successfully', {
        ...bidResult,
        bidderName: `${user.firstName} ${user.lastName}`
      }));
    } catch (error) {
      next(error);
    }
  }

  // Get auction bids
  public static async getAuctionBids(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const filters = req.query;
      
      const bids = await bidService.getAuctionBids(id, filters);
      
      res.json(new ApiResponse(200, 'Bids fetched successfully', bids));
    } catch (error) {
      next(error);
    }
  }

  // Get user's bids
  public static async getUserBids(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const filters = req.query;
      
      const bids = await bidService.getUserBids(user.id, filters);
      
      res.json(new ApiResponse(200, 'User bids fetched successfully', bids));
    } catch (error) {
      next(error);
    }
  }

  // Update auction status
  public static async updateAuctionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = (req as any).user;
      
      const auction = await auctionService.updateAuctionStatus(
        id, 
        status, 
        user.role === 'admin' ? undefined : user.id
      );
      
      res.json(new ApiResponse(200, 'Auction status updated successfully', auction));
    } catch (error) {
      next(error);
    }
  }

  // Get live auctions
  public static async getLiveAuctions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auctions = await auctionService.getLiveAuctions();
      
      res.json(new ApiResponse(200, 'Live auctions fetched successfully', auctions));
    } catch (error) {
      next(error);
    }
  }

  // Get auctions by company
  public static async getCompanyAuctions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const filters = req.query;
      
      // Allow admins to view any company's auctions
      const companyId = user.role === 'admin' 
        ? (req.params.companyId || user.id)
        : user.id;
      
      const result = await auctionService.getAuctionsByCompany(companyId, filters);
      
      res.json(
        new ApiResponse(200, 'Company auctions fetched successfully', {
          auctions: result.auctions,
          total: result.total
        })
      );
    } catch (error) {
      next(error);
    }
  }

  // Watch/unwatch auction
  public static async toggleWatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const { watch } = req.body; // true to watch, false to unwatch
      
      const auction = await auctionService.getAuctionById(id);
      
      if (watch) {
        auction.totalWatches += 1;
      } else {
        auction.totalWatches = Math.max(0, auction.totalWatches - 1);
      }
      
      await auction.save();
      
      // In a real app, you would have a Watch model to track which users are watching
      logger.info(`User ${user.id} ${watch ? 'watched' : 'unwatched'} auction ${id}`);
      
      res.json(
        new ApiResponse(200, `Auction ${watch ? 'added to' : 'removed from'} watchlist`, {
          totalWatches: auction.totalWatches,
          isWatching: watch
        })
      );
    } catch (error) {
      next(error);
    }
  }
}