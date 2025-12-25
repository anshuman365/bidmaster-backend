
import { Router } from 'express';
import { AuctionController } from '../controllers/auction.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';

const router = Router();

router.route('/')
  .get(asyncHandler(AuctionController.getAuctions))
  .post(protect, authorize('company', 'admin'), asyncHandler(AuctionController.createAuction));

router.route('/:id')
  .get(asyncHandler(AuctionController.getAuction))
  .put(protect, authorize('company', 'admin'), asyncHandler(AuctionController.updateAuction))
  .delete(protect, authorize('admin'), asyncHandler(AuctionController.deleteAuction));

router.post('/:id/start', protect, authorize('company', 'admin'), asyncHandler(AuctionController.startAuction));
router.post('/:id/bid', protect, authorize('bidder'), asyncHandler(AuctionController.placeBid));

export default router;
