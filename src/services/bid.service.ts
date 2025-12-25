
import Auction from '../database/models/Auction';
import { ApiResponse } from '../utils/helpers';
import sequelize from '../config/database';

export class BidService {
  public static async placeBid(auctionId: string, bidderId: string, amount: number) {
    const transaction = await sequelize.transaction();
    try {
      const auction = await (Auction as any).findByPk(auctionId, { transaction });
      
      if (!auction) throw new ApiResponse(404, 'Auction not found');
      if (auction.status !== 'live') throw new ApiResponse(400, 'Auction is not live');
      
      const minBid = auction.currentHighestBid + (auction.auctionConfig.bidIncrement || 0);
      if (amount < minBid) {
        throw new ApiResponse(400, `Minimum bid required is ${minBid}`);
      }

      const previousHighestBidderId = auction.currentHighestBidderId;

      auction.currentHighestBid = amount;
      auction.currentHighestBidderId = bidderId;
      auction.totalBids += 1;
      
      await auction.save({ transaction });
      await transaction.commit();

      return {
        amount,
        bidderId,
        previousHighestBidderId,
        auctionTotalBids: auction.totalBids
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export const bidService = BidService;
