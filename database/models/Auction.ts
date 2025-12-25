
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
  public id!: string;
  public companyId!: string;
  public title!: string;
  public description!: string;
  public category!: 'machinery' | 'vehicles' | 'property' | 'goods' | 'services';
  public subcategory!: string;
  public itemDetails!: any;
  public auctionConfig!: any;
  public timing!: any;
  public terms!: any;
  public status!: 'draft' | 'scheduled' | 'live' | 'paused' | 'ended' | 'cancelled' | 'sold';
  public currentHighestBid!: number;
  public currentHighestBidderId!: string | null;
  public totalBids!: number;
  public totalBidders!: number;
  public totalViews!: number;
  public totalWatches!: number;
  public winnerId!: string | null;
  public winnerAmount!: number | null;
  public commissionAmount!: number | null;
  public taxAmount!: number | null;
  public finalAmount!: number | null;
  public metadata!: any;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public isLive(): boolean {
    const now = new Date();
    return this.status === 'live' && now >= new Date(this.timing.biddingStartsAt) && now <= new Date(this.timing.biddingEndsAt);
  }
}

// Fix: Cast Auction to any to access static init()
(Auction as any).init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    companyId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.ENUM('machinery', 'vehicles', 'property', 'goods', 'services'), allowNull: false },
    subcategory: { type: DataTypes.STRING, allowNull: false },
    itemDetails: { type: DataTypes.JSONB, allowNull: false },
    auctionConfig: { type: DataTypes.JSONB, allowNull: false },
    timing: { type: DataTypes.JSONB, allowNull: false },
    terms: { type: DataTypes.JSONB, allowNull: false },
    status: { type: DataTypes.ENUM('draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold'), defaultValue: 'draft' },
    currentHighestBid: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    currentHighestBidderId: { type: DataTypes.UUID, allowNull: true },
    totalBids: { type: DataTypes.INTEGER, defaultValue: 0 },
    totalBidders: { type: DataTypes.INTEGER, defaultValue: 0 },
    totalViews: { type: DataTypes.INTEGER, defaultValue: 0 },
    totalWatches: { type: DataTypes.INTEGER, defaultValue: 0 },
    winnerId: { type: DataTypes.UUID, allowNull: true },
    winnerAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    commissionAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    taxAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    finalAmount: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    metadata: { type: DataTypes.JSONB, defaultValue: { featured: false, promoted: false, urgent: false, featuredUntil: null } },
  },
  {
    sequelize,
    tableName: 'auctions',
    timestamps: true,
  }
);

export default Auction;
