import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database';

interface BidAttributes {
  id: string;
  auctionId: string;
  bidderId: string;
  amount: number;
  isAutoBid: boolean;
  maxAutoBidAmount: number | null;
  status: 'active' | 'outbid' | 'winning' | 'withdrawn' | 'invalid';
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class Bid extends Model<BidAttributes> implements BidAttributes {
  declare id: string;
  declare auctionId: string;
  declare bidderId: string;
  declare amount: number;
  declare isAutoBid: boolean;
  declare maxAutoBidAmount: number | null;
  declare status: 'active' | 'outbid' | 'winning' | 'withdrawn' | 'invalid';
  declare metadata: any;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Bid.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  auctionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'auctions',
      key: 'id'
    }
  },
  bidderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  isAutoBid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  maxAutoBidAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'outbid', 'winning', 'withdrawn', 'invalid'),
    defaultValue: 'active'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {
      ipAddress: null,
      userAgent: null,
      deviceInfo: null
    }
  }
}, {
  sequelize,
  tableName: 'bids',
  timestamps: true,
  indexes: [
    { fields: ['auctionId'] },
    { fields: ['bidderId'] },
    { fields: ['auctionId', 'bidderId'] },
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ]
});

export default Bid;