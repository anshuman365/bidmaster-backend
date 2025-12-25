import Razorpay from 'razorpay';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import Payment from '../database/models/Payment';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/helpers';

interface PaymentData {
  amount: number;
  currency: string;
  userId: string;
  auctionId?: string;
  description?: string;
  metadata?: any;
}

export class PaymentService {
  private razorpay: Razorpay;
  private stripe: Stripe;

  constructor() {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials not configured');
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured');
    }

    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { 
      apiVersion: '2023-10-16' 
    });
  }

  public async createPaymentOrder(paymentData: PaymentData): Promise<any> {
    try {
      const receipt = `receipt_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
      
      const order = await this.razorpay.orders.create({
        amount: paymentData.amount * 100, // Convert to paise
        currency: paymentData.currency || 'INR',
        receipt,
        notes: {
          userId: paymentData.userId,
          auctionId: paymentData.auctionId,
          ...paymentData.metadata
        }
      });

      // Save payment record
      await Payment.create({
        id: uuidv4(),
        userId: paymentData.userId,
        auctionId: paymentData.auctionId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'INR',
        provider: 'razorpay',
        providerOrderId: order.id,
        status: 'created',
        metadata: paymentData.metadata
      });

      logger.info(`Payment order created: ${order.id} for user ${paymentData.userId}`);
      
      return order;
    } catch (error: any) {
      logger.error('Error creating payment order:', error);
      throw new ApiResponse(500, 'Failed to create payment order', { error: error.message });
    }
  }

  public async createStripePaymentIntent(paymentData: PaymentData): Promise<any> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: paymentData.amount * 100, // Convert to cents
        currency: paymentData.currency || 'usd',
        metadata: {
          userId: paymentData.userId,
          auctionId: paymentData.auctionId,
          ...paymentData.metadata
        },
        description: paymentData.description || 'Auction Payment'
      });

      // Save payment record
      await Payment.create({
        id: uuidv4(),
        userId: paymentData.userId,
        auctionId: paymentData.auctionId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'usd',
        provider: 'stripe',
        providerOrderId: paymentIntent.id,
        status: 'created',
        metadata: paymentData.metadata
      });

      logger.info(`Stripe payment intent created: ${paymentIntent.id} for user ${paymentData.userId}`);
      
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };
    } catch (error: any) {
      logger.error('Error creating Stripe payment intent:', error);
      throw new ApiResponse(500, 'Failed to create payment intent', { error: error.message });
    }
  }

  public async verifyRazorpayPayment(paymentId: string, orderId: string, signature: string): Promise<boolean> {
    try {
      const crypto = require('crypto');
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(orderId + '|' + paymentId)
        .digest('hex');

      if (generatedSignature === signature) {
        // Update payment status
        await Payment.update(
          { status: 'completed' },
          { where: { providerOrderId: orderId } }
        );
        
        logger.info(`Razorpay payment verified: ${paymentId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error verifying Razorpay payment:', error);
      throw new ApiResponse(500, 'Payment verification failed');
    }
  }

  public async handleStripeWebhook(event: any): Promise<void> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          await Payment.update(
            { status: 'completed' },
            { where: { providerOrderId: paymentIntent.id } }
          );
          logger.info(`Stripe payment succeeded: ${paymentIntent.id}`);
          break;

        case 'payment_intent.payment_failed':
          const failedIntent = event.data.object;
          await Payment.update(
            { status: 'failed', metadata: { failureReason: failedIntent.last_payment_error } },
            { where: { providerOrderId: failedIntent.id } }
          );
          logger.error(`Stripe payment failed: ${failedIntent.id}`);
          break;

        default:
          logger.info(`Unhandled Stripe event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling Stripe webhook:', error);
      throw error;
    }
  }

  public async getPaymentHistory(userId: string, filters: any = {}): Promise<{ payments: Payment[]; total: number }> {
    try {
      const whereClause: any = { userId };
      
      if (filters.status) {
        whereClause.status = filters.status;
      }
      
      if (filters.auctionId) {
        whereClause.auctionId = filters.auctionId;
      }

      const { rows, count } = await Payment.findAndCountAll({
        where: whereClause,
        limit: parseInt(filters.limit?.toString() || '10'),
        offset: parseInt(filters.offset?.toString() || '0'),
        order: [['createdAt', 'DESC']]
      });

      return { payments: rows, total: count };
    } catch (error) {
      logger.error('Error getting payment history:', error);
      throw new ApiResponse(500, 'Failed to fetch payment history');
    }
  }

  public async refundPayment(paymentId: string, reason?: string): Promise<boolean> {
    try {
      const payment = await Payment.findByPk(paymentId);
      
      if (!payment) {
        throw new ApiResponse(404, 'Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new ApiResponse(400, 'Only completed payments can be refunded');
      }

      let refundResult;
      
      if (payment.provider === 'stripe') {
        refundResult = await this.stripe.refunds.create({
          payment_intent: payment.providerOrderId,
          reason: reason || 'requested_by_customer'
        });
      } else if (payment.provider === 'razorpay') {
        refundResult = await this.razorpay.payments.refund(payment.providerOrderId, {
          amount: payment.amount * 100,
          notes: { reason }
        });
      } else {
        throw new ApiResponse(400, 'Unsupported payment provider');
      }

      // Update payment status
      await payment.update({ 
        status: 'refunded',
        metadata: { 
          ...payment.metadata,
          refundId: refundResult.id,
          refundReason: reason,
          refundedAt: new Date()
        }
      });

      logger.info(`Payment refunded: ${paymentId} (${refundResult.id})`);
      
      return true;
    } catch (error) {
      if (error instanceof ApiResponse) {
        throw error;
      }
      logger.error('Error refunding payment:', error);
      throw new ApiResponse(500, 'Failed to process refund');
    }
  }
}

export const paymentService = new PaymentService();