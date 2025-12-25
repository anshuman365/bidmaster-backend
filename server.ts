import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

// Config
dotenv.config();
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { setupSwagger } from './docs/swagger';
import { logger } from './utils/logger';

// Middleware
import { errorHandler } from './middleware/error.middleware';
import { rateLimiter } from './middleware/rateLimiter.middleware';

// Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import companyRoutes from './routes/company.routes';
import auctionRoutes from './routes/auction.routes';
import bidRoutes from './routes/bid.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import analyticsRoutes from './routes/analytics.routes';

// Sockets
import { setupAuctionSocket } from './sockets/auction.socket';

class App {
  public app: Application;
  public port: string | number;
  public httpServer: any;
  public io: Server;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 5000;
    // Fix: Cast this.app to any to resolve RequestListener type mismatch
    this.httpServer = createServer(this.app as any);
    this.io = new Server(this.httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.initializeDatabase();
    this.initializeRedis();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeSockets();
    this.initializeErrorHandling();
    this.initializeSwagger();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await connectDatabase();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      process.exit(1);
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      const pubClient = await connectRedis();
      const subClient = pubClient.duplicate();
      
      this.io.adapter(createAdapter(pubClient, subClient));
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Redis connection failed:', error);
    }
  }

  private initializeMiddleware(): void {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));
    
    // CORS
    this.app.use(cors({
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression
    this.app.use(compression());

    // Logging
    this.app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

    // Body parser
    // Fix: Cast middleware to any to bypass PathParams type mismatch
    this.app.use(express.json({ limit: '50mb' }) as any);
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }) as any);

    // Rate limiting
    // Fix: Bypass type mismatch on use() by casting app to any to resolve overload errors
    (this.app as any).use(rateLimiter);
  }

  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'success',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // API Routes
    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/users', userRoutes);
    this.app.use('/api/v1/companies', companyRoutes);
    this.app.use('/api/v1/auctions', auctionRoutes);
    this.app.use('/api/v1/bids', bidRoutes);
    this.app.use('/api/v1/payments', paymentRoutes);
    this.app.use('/api/v1/admin', adminRoutes);
    this.app.use('/api/v1/analytics', analyticsRoutes);

    // Webhook endpoints
    this.app.use('/webhooks/payment', express.raw({ type: 'application/json' }), paymentRoutes);
  }

  private initializeSockets(): void {
    setupAuctionSocket(this.io);
    logger.info('WebSocket server initialized');
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  private initializeSwagger(): void {
    setupSwagger(this.app);
  }

  public listen(): void {
    this.httpServer.listen(this.port, () => {
      logger.info(`Server is running on port ${this.port}`);
      logger.info(`API Documentation: http://localhost:${this.port}/api-docs`);
    });
  }
}

// Start server
const app = new App();
app.listen();

export default app;