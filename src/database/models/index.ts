import sequelize from '../config/database';
import User from './User';
import Auction from './Auction';
import Payment from './Payment';
import Bid from './Bid';
import Company from './Company';

// Define associations
Auction.belongsTo(User, { foreignKey: 'companyId', as: 'company' });
Auction.belongsTo(User, { foreignKey: 'currentHighestBidderId', as: 'highestBidder' });
Auction.belongsTo(User, { foreignKey: 'winnerId', as: 'winner' });

User.hasMany(Auction, { foreignKey: 'companyId', as: 'auctions' });
User.hasMany(Auction, { foreignKey: 'currentHighestBidderId', as: 'leadingBids' });
User.hasMany(Auction, { foreignKey: 'winnerId', as: 'wonAuctions' });

// Bid associations
Bid.belongsTo(Auction, { foreignKey: 'auctionId', as: 'auction' });
Bid.belongsTo(User, { foreignKey: 'bidderId', as: 'bidder' });

Auction.hasMany(Bid, { foreignKey: 'auctionId', as: 'bids' });
User.hasMany(Bid, { foreignKey: 'bidderId', as: 'bids' });

// Company associations
Company.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasOne(Company, { foreignKey: 'userId', as: 'companyProfile' });

// Payment associations
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Payment.belongsTo(Auction, { foreignKey: 'auctionId', as: 'auction' });

User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
Auction.hasMany(Payment, { foreignKey: 'auctionId', as: 'payments' });

const models = {
  User,
  Auction,
  Payment,
  Bid,
  Company,
  sequelize
};

// Sync models in development
if (process.env.NODE_ENV === 'development') {
  sequelize.sync({ alter: true }).then(() => {
    console.log('Database models synced');
  }).catch(console.error);
}

export default models;