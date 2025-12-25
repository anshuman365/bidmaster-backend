
import Auction from '../database/models/Auction';
import { ApiResponse } from '../utils/helpers';
import { Op } from 'sequelize';

export class AuctionService {
  public static async getAuctions(filters: any) {
    const { category, status, minPrice, maxPrice, search, limit = 10, offset = 0 } = filters;
    const query: any = {};

    if (category && category !== 'all') query.category = category;
    if (status) query.status = status;
    if (search) query.title = { [Op.iLike]: `%${search}%` };
    
    if (minPrice || maxPrice) {
      query.currentHighestBid = {};
      if (minPrice) query.currentHighestBid[Op.gte] = minPrice;
      if (maxPrice) query.currentHighestBid[Op.lte] = maxPrice;
    }

    const { rows, count } = await (Auction as any).findAndCountAll({
      where: query,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    return { auctions: rows, total: count };
  }

  public static async getAuctionById(id: string) {
    const auction = await (Auction as any).findByPk(id);
    if (!auction) throw new ApiResponse(404, 'Auction not found');
    return auction;
  }

  public static async createAuction(data: any, companyId: string) {
    return await (Auction as any).create({ ...data, companyId, status: 'scheduled' });
  }

  public static async updateAuctionStatus(id: string, status: string) {
    const auction = await this.getAuctionById(id);
    auction.status = status;
    return await auction.save();
  }
}

export const auctionService = AuctionService;
