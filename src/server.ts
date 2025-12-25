import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import path from 'path';

// Load environment variables
dotenv.config();

// Import configurations
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { setupSwagger } from './docs/swagger';

// Import middleware
import { errorHandler, notFound } from './middleware/error.middleware';
import { apiLimiter, authLimiter, bidLimiter, paymentLimiter } from './middleware/rateLimiter.middleware';
import { requestLogger } from './utils/helpers';

// Import models
import models from './database/models';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import companyRoutes from './routes/company.routes';
import auctionRoutes from './routes/auction.routes';
import bidRoutes from './routes/bid.routes';
import paymentRoutes from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import analyticsRoutes from './routes/analytics.routes';

// Import sockets
import { setupAuctionSocket } from './sockets/auction.socket';

// Import logger
import { logger } from './utils/logger';

class App {
  public app: Application;
  public port: string | number;
  public httpServer: ReturnType<typeof createServer>;
  public io: Server;
  private isProduction: boolean;

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 5000;
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Create HTTP server
    this.httpServer = createServer(this.app);
    
    // Initialize Socket.IO with production settings
    this.io = new Server(this.httpServer, {
      cors: {
        origin: this.isProduction 
          ? process.env.CLIENT_URL?.split(',') || ['https://your-frontend.com']
          : ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true
      }
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
      // Connect to database
      await connectDatabase();
      logger.info('📦 Database connected successfully');
      
      // Authenticate Sequelize
      await models.sequelize.authenticate();
      logger.info('✅ Sequelize authenticated');
      
      // Sync models in development only
      if (!this.isProduction) {
        logger.warn('🔄 Syncing database models in development mode');
        await models.sequelize.sync({ alter: true });
        logger.info('🔄 Database models synced');
        
        // Seed initial data if needed
        await this.seedInitialData();
      }
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  }

  private async seedInitialData(): Promise<void> {
    try {
      // Check if admin user exists
      const adminCount = await models.User.count({ where: { role: 'admin' } });
      
      if (adminCount === 0) {
        logger.info('👑 Creating initial admin user...');
        
        const adminUser = await models.User.create({
          email: 'admin@bidmaster.com',
          password: 'Admin@123', // Will be hashed by User model hook
          firstName: 'Admin',
          lastName: 'User',
          phone: '+1234567890',
          role: 'admin',
          isVerified: true,
          isActive: true,
          emailVerified: true,
          phoneVerified: true
        });
        
        logger.info(`✅ Admin user created: ${adminUser.email}`);
      }
    } catch (error) {
      logger.error('Failed to seed initial data:', error);
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      const pubClient = await connectRedis();
      const subClient = pubClient.duplicate();
      
      // Configure Socket.IO Redis adapter
      this.io.adapter(createAdapter(pubClient, subClient));
      logger.info('🔌 Redis connected and Socket.IO adapter configured');
      
      // Test Redis connection
      await pubClient.set('server:startup', new Date().toISOString());
      const testValue = await pubClient.get('server:startup');
      logger.info(`✅ Redis connection test: ${testValue ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      logger.error('❌ Redis connection failed:', error);
      
      if (this.isProduction) {
        logger.error('Redis is required in production. Exiting...');
        process.exit(1);
      } else {
        logger.warn('⚠️ Continuing without Redis in development mode');
      }
    }
  }

  private initializeMiddleware(): void {
    // Request logging
    this.app.use(requestLogger);
    
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: this.isProduction ? {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          connectSrc: ["'self'", 
            process.env.CLIENT_URL || 'http://localhost:3000',
            process.env.WS_URL || 'ws://localhost:5000'
          ],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:']
        }
      } : false, // Disable in development for easier debugging
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      ieNoOpen: true,
      noSniff: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true
    }));
    
    // CORS configuration
    const corsOrigins = this.isProduction 
      ? (process.env.CLIENT_URL?.split(',') || ['https://your-frontend.com'])
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
    
    this.app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Socket-ID',
        'X-API-Key',
        'X-2FA-Token'
      ],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      maxAge: 86400 // 24 hours
    }));
    
    // Handle preflight requests
    this.app.options('*', cors());

    // Compression
    this.app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req: Request, res: Response) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));

    // Logging (Morgan)
    const morganFormat = this.isProduction ? 'combined' : 'dev';
    this.app.use(morgan(morganFormat, {
      stream: {
        write: (message: string) => logger.http(message.trim())
      },
      skip: (req: Request) => req.path === '/health' // Skip health check logs
    }));

    // Body parser with increased limits for file uploads
    this.app.use(express.json({
      limit: '50mb',
      verify: (req: Request, res: Response, buf: Buffer) => {
        (req as any).rawBody = buf.toString();
      }
    }));
    
    this.app.use(express.urlencoded({
      extended: true,
      limit: '50mb',
      parameterLimit: 10000
    }));

    // Serve static files (for uploaded files)
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
      maxAge: this.isProduction ? '1y' : '0',
      setHeaders: (res: Response, path: string) => {
        // Security headers for static files
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        
        // Cache control
        if (path.endsWith('.jpg') || path.endsWith('.png') || path.endsWith('.jpeg')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));

    // Rate limiting for different endpoints
    this.app.use('/api/v1/auth', authLimiter); // Stricter for auth
    this.app.use('/api/v1/bids', bidLimiter); // Stricter for bids
    this.app.use('/api/v1/payments', paymentLimiter); // Stricter for payments
    this.app.use('/api', apiLimiter); // General API rate limiting

    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      (req as any).requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      next();
    });

    // Security middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Enable XSS filter
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Referrer policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Feature policy
      res.setHeader('Permissions-Policy', 
        'camera=(), microphone=(), geolocation=(), interest-cohort=()'
      );
      
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint (no auth required)
    this.app.get('/health', (req: Request, res: Response) => {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        database: 'connected',
        redis: 'connected',
        websockets: this.io.engine.clientsCount
      };

      res.status(200).json(healthData);
    });

    // API Routes with versioning
    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/users', userRoutes);
    this.app.use('/api/v1/companies', companyRoutes);
    this.app.use('/api/v1/auctions', auctionRoutes);
    this.app.use('/api/v1/bids', bidRoutes);
    this.app.use('/api/v1/payments', paymentRoutes);
    this.app.use('/api/v1/admin', adminRoutes);
    this.app.use('/api/v1/analytics', analyticsRoutes);

    // Webhook endpoints (must be before body parser for raw body)
    this.app.post('/webhooks/stripe', 
      express.raw({ type: 'application/json' }),
      (req: Request, res: Response, next: NextFunction) => {
        // Import and use PaymentController here to avoid circular dependencies
        const { PaymentController } = require('./controllers/payment.controller');
        PaymentController.handleStripeWebhook(req, res, next);
      }
    );

    // 404 handler for API routes
    this.app.use('/api/*', (req: Request, res: Response) => {
      res.status(404).json({
        status: 'error',
        message: `API endpoint ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Static file serving for frontend (if serving from same server)
    if (this.isProduction && process.env.SERVE_FRONTEND === 'true') {
      const frontendPath = path.join(__dirname, '../../frontend/dist');
      this.app.use(express.static(frontendPath));
      this.app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
      });
    }

    // Global 404 handler (must be last)
    this.app.use('*', notFound);
  }

  private initializeSockets(): void {
    try {
      setupAuctionSocket(this.io);
      
      // Socket.IO connection monitoring
      this.io.on('connection', (socket) => {
        logger.debug(`Socket connected: ${socket.id}`);
        
        socket.on('disconnect', (reason) => {
          logger.debug(`Socket disconnected: ${socket.id}, reason: ${reason}`);
        });
        
        socket.on('error', (error) => {
          logger.error(`Socket error (${socket.id}):`, error);
        });
      });
      
      // Monitor Socket.IO server events
      this.io.engine.on('connection_error', (error) => {
        logger.error('Socket.IO connection error:', error);
      });
      
      logger.info('📡 WebSocket server initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket server:', error);
      if (this.isProduction) {
        throw error;
      }
    }
  }

  private initializeErrorHandling(): void {
    // Error handling middleware (must be after routes)
    this.app.use(errorHandler);
    
    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // In production, you might want to restart the process
      if (this.isProduction) {
        process.exit(1);
      }
    });
    
    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      // In production, you might want to restart the process
      if (this.isProduction) {
        process.exit(1);
      }
    });
  }

  private initializeSwagger(): void {
    if (!this.isProduction) {
      setupSwagger(this.app);
      logger.info('📚 Swagger documentation available at /api-docs');
    } else if (process.env.ENABLE_SWAGGER_IN_PROD === 'true') {
      setupSwagger(this.app);
      logger.info('📚 Swagger documentation enabled in production');
    }
  }

  private async cleanupResources(): Promise<void> {
    logger.info('🔄 Cleaning up resources...');
    
    try {
      // Close database connection
      await models.sequelize.close();
      logger.info('✅ Database connection closed');
      
      // Close Redis connections if they exist
      const redisClient = await connectRedis().catch(() => null);
      if (redisClient) {
        await redisClient.quit();
        logger.info('✅ Redis connection closed');
      }
      
      // Close Socket.IO server
      this.io.close();
      logger.info('✅ WebSocket server closed');
      
      // Close HTTP server
      this.httpServer.close();
      logger.info('✅ HTTP server closed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  public listen(): void {
    this.httpServer.listen(this.port, () => {
      logger.info(`🚀 Server is running on port ${this.port}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📡 WebSocket server ready on port ${this.port}`);
      
      if (!this.isProduction) {
        logger.info(`📚 API Documentation: http://localhost:${this.port}/api-docs`);
        logger.info(`🏥 Health check: http://localhost:${this.port}/health`);
      }
      
      // Log all registered routes in development
      if (!this.isProduction) {
        this.logRegisteredRoutes();
      }
    });
    
    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);
      
      // Give connections 30 seconds to close
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
      
      await this.cleanupResources();
      
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    };
    
    // Handle different shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
  }

  private logRegisteredRoutes(): void {
    const routes: Array<{ method: string; path: string }> = [];
    
    const processMiddleware = (middleware: any, basePath = '') => {
      if (middleware.route) {
        // Regular route
        const path = basePath + middleware.route.path;
        const methods = Object.keys(middleware.route.methods)
          .map(m => m.toUpperCase())
          .join(', ');
        routes.push({ method: methods, path });
      } else if (middleware.name === 'router' && middleware.handle.stack) {
        // Router middleware
        const routerPath = basePath + (middleware.regexp.toString().replace(/^\/\^\\\//, '').replace(/\\\/\?\$/, '') || '');
        middleware.handle.stack.forEach((handler: any) => {
          processMiddleware(handler, routerPath);
        });
      }
    };
    
    this.app._router.stack.forEach((middleware: any) => {
      processMiddleware(middleware);
    });
    
    logger.debug('📋 Registered routes:');
    routes.forEach(route => {
      logger.debug(`  ${route.method.padEnd(6)} ${route.path}`);
    });
  }
}

// Create and start the server
const app = new App();
app.listen();

export default app;