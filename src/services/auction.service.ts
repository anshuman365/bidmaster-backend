import { Op } from 'sequelize';
import Auction from '../database/models/Auction';
import { ApiResponse } from '../utils/helpers';
import { logger } from '../utils/logger';

export class AuctionService {
  public static async getAuctions(filters: any): Promise<{ auctions: Auction[]; total: number }> {
    try {
      const { 
        category, 
        status, 
        minPrice, 
        maxPrice, 
        search, 
        limit = 10, 
        offset = 0,
        companyId,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = filters;

      const query: any = {};

      if (category && category !== 'all') {
        query.category = category;
      }
      
      if (status && status !== 'all') {
        query.status = status;
      }
      
      if (companyId) {
        query.companyId = companyId;
      }
      
      if (search) {
        query[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }
      
      if (minPrice || maxPrice) {
        query.currentHighestBid = {};
        if (minPrice) query.currentHighestBid[Op.gte] = parseFloat(minPrice);
        if (maxPrice) query.currentHighestBid[Op.lte] = parseFloat(maxPrice);
      }

      const validSortFields = ['createdAt', 'currentHighestBid', 'totalBids', 'totalViews'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const { rows, count } = await Auction.findAndCountAll({
        where: query,
        limit: parseInt(limit.toString()),
        offset: parseInt(offset.toString()),
        order: [[sortField, order]],
        include: [
          {
            association: 'company',
            attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture']
          },
          {
            association: 'highestBidder',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      });

      return { auctions: rows, total: count };
    } catch (error) {
      logger.error('Error getting auctions:', error);
      throw new ApiResponse(500, 'Failed to fetch auctions');
    }
  }

  public static async getAuctionById(id: string): Promise<Auction> {
    try {
      const auction = await Auction.findByPk(id, {
        include: [
          {
            association: 'company',
            attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture', 'phone']
          },
          {
            association: 'highestBidder',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            association: 'winner',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      });
      
      if (!auction) {
        throw new ApiResponse(404, 'Auction not found');
      }

      // Increment view count
      auction.totalViews += 1;
      await auction.save();

      return auction;
    } catch (error) {
      if (error instanceof ApiResponse) {
        throw error;
      }
      logger.error('Error getting auction by ID:', error);
      throw new ApiResponse(500, 'Failed to fetch auction');
    }
  }

  public static async createAuction(data: any, companyId: string): Promise<Auction> {
    try {
      const auctionData = {
        ...data,
        companyId,
        status: 'draft'
      };

      const auction = await Auction.create(auctionData);
      logger.info(`Auction created: ${auction.title} (${auction.id})`);
      
      return auction;
    } catch (error) {
      logger.error('Error creating auction:', error);
      throw new ApiResponse(500, 'Failed to create auction');
    }
  }

  public static async updateAuction(id: string, updateData: any, companyId?: string): Promise<Auction> {
    try {
      const auction = await this.getAuctionById(id);

      // Check permission
      if (companyId && auction.companyId !== companyId) {
        throw new ApiResponse(403, 'Not authorized to update this auction');
      }

      // Don't allow updating certain fields
      delete updateData.id;
      delete updateData.companyId;
      delete updateData.currentHighestBid;
      delete updateData.currentHighestBidderId;
      delete updateData.totalBids;
      delete updateData.totalBidders;

      await auction.update(updateData);
      await auction.reload();

      logger.info(`Auction updated: ${auction.title} (${auction.id})`);
      
      return auction;
    } catch (error) {
      if (error instanceof ApiResponse) {
        throw error;
      }
      logger.error('Error updating auction:', error);
      throw new ApiResponse(500, 'Failed to update auction');
    }
  }

  public static async updateAuctionStatus(id: string, status: string, companyId?: string): Promise<Auction> {
    try {
      const auction = await this.getAuctionById(id);

      // Check permission
      if (companyId && auction.companyId !== companyId) {
        throw new ApiResponse(403, 'Not authorized to update this auction');
      }

      const validStatuses = ['draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold'];
      
      if (!validStatuses.includes(status)) {
        throw new ApiResponse(400, 'Invalid status');
      }

      auction.status = status as any;
      
      // If auction is ending, set winner if there's a highest bidder
      if (status === 'ended' && auction.currentHighestBidderId) {
        auction.winnerId = auction.currentHighestBidderId;
        auction.winnerAmount = auction.currentHighestBid;
        auction.finalAmount = auction.currentHighestBid;
      }

      await auction.save();
      logger.info(`Auction status updated: ${auction.id} -> ${status}`);
      
      return auction;
    } catch (error) {
      if (error instanceof ApiResponse) {
        throw error;
      }
      logger.error('Error updating auction status:', error);
      throw new ApiResponse(500, 'Failed to update auction status');
    }
  }

  public static async deleteAuction(id: string, companyId?: string): Promise<void> {
    try {
      const auction = await this.getAuctionById(id);

      // Check permission (only owner or admin can delete)
      if (companyId && auction.companyId !== companyId) {
        throw new ApiResponse(403, 'Not authorized to delete this auction');
      }

      // Don't allow deletion of live auctions
      if (auction.status === 'live') {
        throw new ApiResponse(400, 'Cannot delete live auction');
      }

      await auction.destroy();
      logger.info(`Auction deleted: ${auction.title} (${auction.id})`);
    } catch (error) {
      if (error instanceof ApiResponse) {
        throw error;
      }
      logger.error('Error deleting auction:', error);
      throw new ApiResponse(500, 'Failed to delete auction');
    }
  }

  public static async startAuction(id: string, companyId: string): Promise<Auction> {
    try {
      const auction = await this.getAuctionById(id);

      if (auction.companyId !== companyId) {
        throw new ApiResponse(403, 'Not authorized to start this auction');
      }

      if (auction.status !== 'scheduled') {
        throw new ApiResponse(400, 'Auction must be scheduled to start');
      }

      // Check if auction timing is valid
      const now = new Date();
      if (auction.timing.biddingStartsAt && new Date(auction.timing.biddingStartsAt) > now) {
        throw new ApiResponse(400, 'Auction start time has not arrived yet');
      }

      auction.status = 'live';
      await auction.save();

      logger.info(`Auction started: ${auction.title} (${auction.id})`);
      
      return auction;
    } catch (error) {
      if (error instanceof ApiResponse) {
        throw error;
      }
      logger.error('Error starting auction:', error);
      throw new ApiResponse(500, 'Failed to start auction');
    }
  }

  public static async getLiveAuctions(): Promise<Auction[]> {
    try {
      const now = new Date();
      
      return await Auction.findAll({
        where: {
          status: 'live',
          'timing.biddingEndsAt': { [Op.gt]: now }
        },
        order: [['timing.biddingEndsAt', 'ASC']],
        include: [
          {
            association: 'company',
            attributes: ['id', 'firstName', 'lastName', 'email', 'profilePicture']
          }
        ]
      });
    } catch (error) {
      logger.error('Error getting live auctions:', error);
      throw new ApiResponse(500, 'Failed to fetch live auctions');
    }
  }

  public static async getAuctionsByCompany(companyId: string, filters: any = {}): Promise<{ auctions: Auction[]; total: number }> {
    try {
      const query: any = { companyId };
      
      if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
      }

      const { rows, count } = await Auction.findAndCountAll({
        where: query,
        limit: parseInt(filters.limit?.toString() || '10'),
        offset: parseInt(filters.offset?.toString() || '0'),
        order: [['createdAt', 'DESC']]
      });

      return { auctions: rows, total: count };
    } catch (error) {
      logger.error('Error getting company auctions:', error);
      throw new ApiResponse(500, 'Failed to fetch company auctions');
    }
  }
}