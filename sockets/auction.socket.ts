
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { auctionService } from '../services/auction.service';
import { bidService } from '../services/bid.service';
import User from '../database/models/User';
import { logger } from '../utils/logger';

export const setupAuctionSocket = (io: Server): void => {
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) { return next(new Error('Authentication error')); }
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      // Fix: Cast User to any to access static findByPk()
      const user = await (User as any).findByPk(decoded.id);
      if (!user) { return next(new Error('User not found')); }
      socket.data.user = user;
      next();
    } catch (error) { next(new Error('Authentication error')); }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    socket.on('JOIN_AUCTION', async (data: { auctionId: string }) => {
      socket.join(`auction:${data.auctionId}`);
      logger.info(`User ${user.email} joined auction: ${data.auctionId}`);
    });

    socket.on('PLACE_BID', async (data: { auctionId: string; amount: number }) => {
      try {
        const bid = await bidService.placeBid(data.auctionId, user.id, data.amount);
        io.to(`auction:${data.auctionId}`).emit('NEW_BID', {
          auctionId: data.auctionId,
          bid: { amount: bid.amount, bidderName: user.firstName, timestamp: new Date() }
        });
      } catch (error: any) {
        socket.emit('BID_ERROR', { message: error.message });
      }
    });
  });
};
