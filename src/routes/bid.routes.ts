import { Router } from 'express';
import { BidController } from '../controllers/bid.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { body } from 'express-validator';
import { bidLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Apply rate limiting to bid routes
router.use(bidLimiter);

// All bid routes require authentication
router.use(protect);

// Place a bid
router.post('/:auctionId', [
  authorize('bidder'),
  body('amount').isFloat({ min: 0.01 }).notEmpty()
], asyncHandler(BidController.placeBid));

// Get bids for an auction
router.get('/auction/:auctionId', asyncHandler(BidController.getAuctionBids));

// Get user's bids
router.get('/user/my-bids', asyncHandler(BidController.getUserBids));

// Get specific bid
router.get('/:bidId', asyncHandler((req: Request, res: Response, next: NextFunction) => {
  // In a real app, you would fetch bid from database
  res.json({
    success: true,
    data: {
      id: req.params.bidId,
      amount: 15000,
      auctionId: 'auc_123',
      bidderId: (req as any).user.id,
      timestamp: new Date()
    }
  });
}));

// Withdraw bid (only before auction ends)
router.delete('/:bidId', authorize('bidder'), asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // In a real app, you would implement bid withdrawal logic
  res.json({
    success: true,
    message: 'Bid withdrawn successfully'
  });
}));

// Auto-bid configuration
router.post('/:auctionId/auto-bid', [
  authorize('bidder'),
  body('maxAmount').isFloat({ min: 0.01 }),
  body('increment').optional().isFloat({ min: 0.01 })
], asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // In a real app, you would set up auto-bidding
  res.json({
    success: true,
    message: 'Auto-bid configured successfully',
    data: req.body
  });
}));

// Get bid analytics
router.get('/analytics/user', authorize('bidder'), asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  
  // In a real app, calculate bid analytics
  const analytics = {
    totalBids: 25,
    totalWon: 5,
    successRate: '20%',
    averageBidAmount: 12000,
    totalAmountBid: 300000,
    favoriteCategory: 'machinery'
  };
  
  res.json({
    success: true,
    data: analytics
  });
}));

export default router;

// Note: We need to create BidController with these methods
export class BidController {
  public static async placeBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { auctionId } = req.params;
      const { amount } = req.body;
      const bidderId = (req as any).user.id;

      // In a real app, you would use bidService
      const result = {
        success: true,
        message: 'Bid placed successfully',
        data: {
          bidId: 'bid_' + Date.now(),
          amount,
          auctionId,
          bidderId,
          timestamp: new Date(),
          isHighest: true
        }
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  public static async getAuctionBids(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { auctionId } = req.params;
      
      // In a real app, fetch bids from database
      const bids = [
        {
          id: 'bid_1',
          amount: 15000,
          bidderName: 'John Doe',
          timestamp: new Date(),
          isWinning: true
        },
        {
          id: 'bid_2',
          amount: 14000,
          bidderName: 'Jane Smith',
          timestamp: new Date(Date.now() - 3600000),
          isWinning: false
        }
      ];

      res.json({
        success: true,
        data: {
          bids,
          total: bids.length,
          highestBid: 15000
        }
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getUserBids(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      
      // In a real app, fetch user bids from database
      const bids = [
        {
          id: 'bid_1',
          auctionId: 'auc_123',
          auctionTitle: 'Industrial Generator',
          amount: 15000,
          status: 'winning',
          placedAt: new Date(),
          auctionEnds: new Date(Date.now() + 86400000)
        }
      ];

      res.json({
        success: true,
        data: {
          bids,
          total: bids.length,
          activeBids: bids.filter(b => b.status === 'winning').length
        }
      });
    } catch (error) {
      next(error);
    }
  }
}