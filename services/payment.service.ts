
import Razorpay from 'razorpay';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import Payment from '../database/models/Payment';
import { logger } from '../utils/logger';

export class PaymentService {
  private razorpay: any;
  private stripe: any;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
  }

  public async createPaymentOrder(paymentData: any): Promise<any> {
    const receipt = `receipt_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
    const order = await this.razorpay.orders.create({
      amount: paymentData.amount * 100,
      currency: paymentData.currency,
      receipt,
    });
    return order;
  }
}

export const paymentService = new PaymentService();
