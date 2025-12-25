import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { protect, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/helpers';
import { body } from 'express-validator';
import { paymentLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Apply rate limiting to payment routes
router.use(paymentLimiter);

// All payment routes require authentication
router.use(protect);

// Create payment order (Razorpay)
router.post('/create-order', [
  body('amount').isFloat({ min: 1 }),
  body('currency').optional().isString(),
  body('auctionId').optional().isString(),
  body('description').optional().isString(),
  body('metadata').optional().isObject()
], asyncHandler(PaymentController.createPaymentOrder));

// Create Stripe payment intent
router.post('/stripe/create-intent', [
  body('amount').isFloat({ min: 0.5 }),
  body('currency').optional().isString(),
  body('auctionId').optional().isString(),
  body('description').optional().isString(),
  body('metadata').optional().isObject()
], asyncHandler(PaymentController.createStripePayment));

// Verify Razorpay payment
router.post('/verify/razorpay', [
  body('razorpay_payment_id').isString().notEmpty(),
  body('razorpay_order_id').isString().notEmpty(),
  body('razorpay_signature').isString().notEmpty()
], asyncHandler(PaymentController.verifyRazorpayPayment));

// Payment history
router.get('/history', asyncHandler(PaymentController.getPaymentHistory));

// Get specific payment
router.get('/:id', asyncHandler(PaymentController.getPayment));

// Create invoice for payment
router.post('/:paymentId/invoice', asyncHandler(PaymentController.createInvoice));

// Check payment status
router.get('/:paymentId/status', asyncHandler(PaymentController.checkPaymentStatus));

// Request refund (user)
router.post('/:paymentId/refund', [
  body('reason').optional().isString()
], asyncHandler(PaymentController.requestRefund));

// Get payment methods
router.get('/methods', asyncHandler(PaymentController.getPaymentMethods));

// Webhook endpoints (no authentication required)
router.post('/webhooks/stripe', 
  express.raw({ type: 'application/json' }),
  asyncHandler(PaymentController.handleStripeWebhook)
);

// Admin only routes
router.post('/admin/refund/:paymentId', 
  authorize('admin'),
  [
    body('reason').optional().isString(),
    body('amount').optional().isFloat({ min: 0 })
  ],
  asyncHandler(PaymentController.requestRefund)
);

export default router;