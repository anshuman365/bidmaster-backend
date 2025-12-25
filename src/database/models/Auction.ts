import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database';

interface AuctionAttributes {
  id: string;
  companyId: string;
  title: string;
  description: string;
  category: 'machinery' | 'vehicles' | 'property' | 'goods' | 'services';
  subcategory: string;
  itemDetails: any;
  auctionConfig: any;
  timing: any;
  terms: any;
  status: 'draft' | 'scheduled' | 'live' | 'paused' | 'ended' | 'cancelled' | 'sold';
  currentHighestBid: number;
  currentHighestBidderId: string | null;
  totalBids: number;
  totalBidders: number;
  totalViews: number;
  totalWatches: number;
  winnerId: string | null;
  winnerAmount: number | null;
  commissionAmount: number | null;
  taxAmount: number | null;
  finalAmount: number | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class Auction extends Model<AuctionAttributes> implements AuctionAttributes {
  declare id: string;
  declare companyId: string;
  declare title: string;
  declare description: string;
  declare category: 'machinery' | 'vehicles' | 'property' | 'goods' | 'services';
  declare subcategory: string;
  declare itemDetails: any;
  declare auctionConfig: any;
  declare timing: any;
  declare terms: any;
  declare status: 'draft' | 'scheduled' | 'live' | 'paused' | 'ended' | 'cancelled' | 'sold';
  declare currentHighestBid: number;
  declare currentHighestBidderId: string | null;
  declare totalBids: number;
  declare totalBidders: number;
  declare totalViews: number;
  declare totalWatches: number;
  declare winnerId: string | null;
  declare winnerAmount: number | null;
  declare commissionAmount: number | null;
  declare taxAmount: number | null;
  declare finalAmount: number | null;
  declare metadata: any;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  public isLive(): boolean {
    const now = new Date();
    return this.status === 'live' && 
           now >= new Date(this.timing.biddingStartsAt) && 
           now <= new Date(this.timing.biddingEndsAt);
  }

  public getMinNextBid(): number {
    return this.currentHighestBid + (this.auctionConfig?.bidIncrement || 0);
  }
}

Auction.init({
  id: { 
    type: DataTypes.UUID, 
    defaultValue: DataTypes.UUIDV4, 
    primaryKey: true 
  },
  companyId: { 
    type: DataTypes.UUID, 
    allowNull: false 
  },
  title: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  description: { 
    type: DataTypes.TEXT, 
    allowNull: false 
  },
  category: { 
    type: DataTypes.ENUM('machinery', 'vehicles', 'property', 'goods', 'services'), 
    allowNull: false 
  },
  subcategory: { 
    type: DataTypes.STRING, 
    allowNull: false 
  },
  itemDetails: { 
    type: DataTypes.JSONB, 
    allowNull: false 
  },
  auctionConfig: { 
    type: DataTypes.JSONB, 
    allowNull: false,
    defaultValue: {
      bidIncrement: 100,
      startingBid: 0,
      reservePrice: null,
      buyNowPrice: null,
      autoExtend: true,
      extensionTime: 300, // 5 minutes in seconds
      maxExtensions: 3
    }
  },
  timing: { 
    type: DataTypes.JSONB, 
    allowNull: false,
    defaultValue: {
      biddingStartsAt: null,
      biddingEndsAt: null,
      previewStartsAt: null,
      previewEndsAt: null
    }
  },
  terms: { 
    type: DataTypes.JSONB, 
    allowNull: false,
    defaultValue: {
      paymentTerms: 'Net 7 days',
      shippingTerms: 'Buyer responsible',
      inspection: 'Available before bidding',
      warranty: 'As is'
    }
  },
  status: { 
    type: DataTypes.ENUM('draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold'), 
    defaultValue: 'draft' 
  },
  currentHighestBid: { 
    type: DataTypes.DECIMAL(15, 2), 
    defaultValue: 0 
  },
  currentHighestBidderId: { 
    type: DataTypes.UUID, 
    allowNull: true 
  },
  totalBids: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  totalBidders: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  totalViews: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  totalWatches: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0 
  },
  winnerId: { 
    type: DataTypes.UUID, 
    allowNull: true 
  },
  winnerAmount: { 
    type: DataTypes.DECIMAL(15, 2), 
    allowNull: true 
  },
  commissionAmount: { 
    type: DataTypes.DECIMAL(15, 2), 
    allowNull: true 
  },
  taxAmount: { 
    type: DataTypes.DECIMAL(15, 2), 
    allowNull: true 
  },
  finalAmount: { 
    type: DataTypes.DECIMAL(15, 2), 
    allowNull: true 
  },
  metadata: { 
    type: DataTypes.JSONB, 
    defaultValue: { 
      featured: false, 
      promoted: false, 
      urgent: false, 
      featuredUntil: null 
    } 
  }
}, {
  sequelize,
  tableName: 'auctions',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['category'] },
    { fields: ['companyId'] },
    { fields: ['currentHighestBidderId'] },
    { fields: ['createdAt'] }
  ]
});

export default Auction;