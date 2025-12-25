import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { ApiResponse } from '../utils/helpers';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';
import Stripe from 'stripe';

export class PaymentController {
  // Create Razorpay order
  public static async createPaymentOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const user = (req as any).user;
      const paymentData = {
        ...req.body,
        userId: user.id
      };

      const order = await paymentService.createPaymentOrder(paymentData);
      
      res.json(new ApiResponse(200, 'Payment order created', order));
    } catch (error) {
      next(error);
    }
  }

  // Create Stripe payment intent
  public static async createStripePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const user = (req as any).user;
      const paymentData = {
        ...req.body,
        userId: user.id
      };

      const result = await paymentService.createStripePaymentIntent(paymentData);
      
      res.json(new ApiResponse(200, 'Stripe payment intent created', result));
    } catch (error) {
      next(error);
    }
  }

  // Verify Razorpay payment
  public static async verifyRazorpayPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
      
      const isValid = await paymentService.verifyRazorpayPayment(
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature
      );

      if (isValid) {
        res.json(new ApiResponse(200, 'Payment verified successfully', { verified: true }));
      } else {
        throw new ApiResponse(400, 'Payment verification failed');
      }
    } catch (error) {
      next(error);
    }
  }

  // Handle Stripe webhook
  public static async handleStripeWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sig = req.headers['stripe-signature'] as string;
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!endpointSecret) {
        throw new ApiResponse(500, 'Stripe webhook secret not configured');
      }

      let event: Stripe.Event;

      try {
        event = paymentService['stripe'].webhooks.constructEvent(
          req.body,
          sig,
          endpointSecret
        );
      } catch (err: any) {
        logger.error('Webhook signature verification failed:', err.message);
        throw new ApiResponse(400, `Webhook Error: ${err.message}`);
      }

      await paymentService.handleStripeWebhook(event);

      res.json(new ApiResponse(200, 'Webhook received'));
    } catch (error) {
      next(error);
    }
  }

  // Get payment history
  public static async getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const filters = req.query;

      const result = await paymentService.getPaymentHistory(user.id, filters);

      res.json(
        new ApiResponse(200, 'Payment history fetched', {
          payments: result.payments,
          total: result.total,
          page: parseInt(filters.offset as string) / parseInt(filters.limit as string || '10') + 1 || 1,
          totalPages: Math.ceil(result.total / parseInt(filters.limit as string || '10'))
        })
      );
    } catch (error) {
      next(error);
    }
  }

  // Request refund
  public static async requestRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      const user = (req as any).user;

      // In a real app, you would check if the user owns this payment
      // For now, we'll allow the request
      const success = await paymentService.refundPayment(paymentId, reason);

      if (success) {
        res.json(new ApiResponse(200, 'Refund request submitted successfully'));
      } else {
        throw new ApiResponse(500, 'Failed to process refund request');
      }
    } catch (error) {
      next(error);
    }
  }

  // Get payment by ID
  public static async getPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      // In a real app, fetch payment from database
      // For now, return mock data
      const payment = {
        id,
        userId: user.id,
        amount: 1000,
        currency: 'INR',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      res.json(new ApiResponse(200, 'Payment fetched successfully', payment));
    } catch (error) {
      next(error);
    }
  }

  // Create invoice for payment
  public static async createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.params;
      const user = (req as any).user;

      // In a real app, generate PDF invoice
      // For now, return mock data
      const invoice = {
        id: `INV-${Date.now()}`,
        paymentId,
        userId: user.id,
        amount: 1000,
        tax: 180,
        total: 1180,
        date: new Date(),
        items: [
          {
            description: 'Auction Winning Bid',
            amount: 1000
          }
        ]
      };

      res.json(new ApiResponse(200, 'Invoice created successfully', invoice));
    } catch (error) {
      next(error);
    }
  }

  // Check payment status
  public static async checkPaymentStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { paymentId } = req.params;

      // In a real app, check payment status from provider
      // For now, return mock data
      const status = {
        paymentId,
        status: 'completed',
        lastUpdated: new Date(),
        canRetry: false
      };

      res.json(new ApiResponse(200, 'Payment status fetched', status));
    } catch (error) {
      next(error);
    }
  }

  // Get payment methods
  public static async getPaymentMethods(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;

      // In a real app, fetch saved payment methods from database
      const paymentMethods = [
        {
          id: 'card_1',
          type: 'card',
          last4: '4242',
          brand: 'visa',
          expiry: '12/25',
          isDefault: true
        }
      ];

      res.json(new ApiResponse(200, 'Payment methods fetched', paymentMethods));
    } catch (error) {
      next(error);
    }
  }
}