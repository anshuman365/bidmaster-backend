import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database';

interface PaymentAttributes {
  id: string;
  userId: string;
  auctionId?: string;
  amount: number;
  currency: string;
  provider: 'razorpay' | 'stripe' | 'paypal';
  providerOrderId: string;
  providerPaymentId?: string;
  status: 'created' | 'pending' | 'completed' | 'failed' | 'refunded';
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

class Payment extends Model<PaymentAttributes> implements PaymentAttributes {
  declare id: string;
  declare userId: string;
  declare auctionId?: string;
  declare amount: number;
  declare currency: string;
  declare provider: 'razorpay' | 'stripe' | 'paypal';
  declare providerOrderId: string;
  declare providerPaymentId?: string;
  declare status: 'created' | 'pending' | 'completed' | 'failed' | 'refunded';
  declare metadata?: any;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Payment.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  auctionId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'USD'
  },
  provider: {
    type: DataTypes.ENUM('razorpay', 'stripe', 'paypal'),
    allowNull: false
  },
  providerOrderId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  providerPaymentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('created', 'pending', 'completed', 'failed', 'refunded'),
    defaultValue: 'created'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  sequelize,
  tableName: 'payments',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['auctionId'] },
    { fields: ['providerOrderId'] },
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ]
});

export default Payment;