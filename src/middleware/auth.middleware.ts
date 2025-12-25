import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { ApiResponse } from '../utils/helpers';
import User, { UserAttributes } from '../database/models/User';
import { logger } from '../utils/logger';
import redisClient from '../config/redis';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserAttributes & { 
        id: string;
        role: 'admin' | 'company' | 'bidder';
        companyId?: string | null;
      };
      requestId?: string;
    }
  }
}

interface DecodedToken extends JwtPayload {
  id: string;
  email: string;
  role: 'admin' | 'company' | 'bidder';
  companyId?: string | null;
  iat: number;
  exp: number;
}

/**
 * Protect routes - verify JWT token
 */
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Get token from cookies
    else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    // Get token from query parameter (for websockets)
    else if (req.query?.token) {
      token = req.query.token as string;
    }

    // Check if token exists
    if (!token) {
      logger.warn(`Unauthorized access attempt: No token provided - ${req.method} ${req.originalUrl}`);
      res.status(401).json(new ApiResponse(401, 'Not authorized. Please login to continue.'));
      return;
    }

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      logger.warn(`Blacklisted token attempt: ${req.method} ${req.originalUrl}`);
      res.status(401).json(new ApiResponse(401, 'Session expired. Please login again.'));
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;

    // Get user from database
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password', 'loginAttempts', 'accountLockedUntil'] }
    });

    if (!user) {
      logger.warn(`User not found for token: ${decoded.id}`);
      res.status(401).json(new ApiResponse(401, 'User not found. Please login again.'));
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn(`Inactive user attempt: ${user.id} - ${user.email}`);
      res.status(401).json(new ApiResponse(401, 'Account is deactivated. Please contact support.'));
      return;
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 1000 / 60);
      logger.warn(`Locked account attempt: ${user.id} - ${user.email}`);
      res.status(423).json(new ApiResponse(423, `Account is locked. Please try again in ${remainingTime} minutes.`));
      return;
    }

    // Check if password was changed after token was issued
    const passwordChangedAt = (user as any).passwordChangedAt;
    if (passwordChangedAt) {
      const changedTimestamp = Math.floor(new Date(passwordChangedAt).getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        logger.warn(`Token issued before password change: ${user.id}`);
        res.status(401).json(new ApiResponse(401, 'Password was recently changed. Please login again.'));
        return;
      }
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      companyId: user.companyId,
      isVerified: user.isVerified,
      isActive: user.isActive,
      profilePicture: user.profilePicture,
      address: user.address,
      kycStatus: user.kycStatus,
      lastLogin: user.lastLogin,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      settings: user.settings,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    // Log successful authentication
    logger.debug(`User authenticated: ${user.id} - ${user.email} - ${req.method} ${req.originalUrl}`);

    next();
  } catch (error: any) {
    logger.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json(new ApiResponse(401, 'Invalid token. Please login again.'));
    } else if (error.name === 'TokenExpiredError') {
      res.status(401).json(new ApiResponse(401, 'Token expired. Please login again.'));
    } else {
      res.status(401).json(new ApiResponse(401, 'Authentication failed. Please login again.'));
    }
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...allowedRoles: ('admin' | 'company' | 'bidder')[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      logger.warn('Authorization attempt without authentication');
      res.status(401).json(new ApiResponse(401, 'Not authenticated'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Unauthorized role attempt: ${req.user.role} tried to access ${req.method} ${req.originalUrl}`);
      res.status(403).json(
        new ApiResponse(403, `Access denied. Required roles: ${allowedRoles.join(', ')}`)
      );
      return;
    }

    // Additional role-specific checks
    if (req.user.role === 'company' && !req.user.companyId) {
      logger.warn(`Company user without companyId: ${req.user.id}`);
      res.status(403).json(new ApiResponse(403, 'Company profile not setup. Please complete your company profile.'));
      return;
    }

    logger.debug(`Authorization granted: ${req.user.role} - ${req.method} ${req.originalUrl}`);
    next();
  };
};

/**
 * Check if user owns the resource (for company users)
 */
export const isOwner = (resourceOwnerField = 'companyId') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(new ApiResponse(401, 'Not authenticated'));
        return;
      }

      // Admin bypass
      if (req.user.role === 'admin') {
        next();
        return;
      }

      // Get resource ID from params
      const resourceId = req.params.id || req.params.auctionId || req.params.companyId;
      
      if (!resourceId) {
        res.status(400).json(new ApiResponse(400, 'Resource ID required'));
        return;
      }

      // Get resource from database
      let resource: any;
      let model: any;

      // Determine which model to use based on route
      if (req.originalUrl.includes('/auctions/')) {
        const Auction = require('../database/models/Auction').default;
        model = Auction;
      } else if (req.originalUrl.includes('/companies/')) {
        const Company = require('../database/models/Company').default;
        model = Company;
      } else if (req.originalUrl.includes('/users/')) {
        model = User;
      } else {
        res.status(400).json(new ApiResponse(400, 'Unsupported resource type'));
        return;
      }

      resource = await model.findByPk(resourceId);

      if (!resource) {
        res.status(404).json(new ApiResponse(404, 'Resource not found'));
        return;
      }

      // Check ownership
      if (resource[resourceOwnerField] !== req.user.id) {
        logger.warn(`Ownership violation: User ${req.user.id} tried to access ${resourceOwnerField} ${resourceId}`);
        res.status(403).json(new ApiResponse(403, 'Not authorized to access this resource'));
        return;
      }

      // Attach resource to request for use in controllers
      (req as any).resource = resource;
      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      res.status(500).json(new ApiResponse(500, 'Server error during ownership check'));
    }
  };
};

/**
 * Two-factor authentication check
 */
export const require2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json(new ApiResponse(401, 'Not authenticated'));
      return;
    }

    const user = await User.findByPk(req.user.id);
    
    if (!user) {
      res.status(401).json(new ApiResponse(401, 'User not found'));
      return;
    }

    if (user.twoFactorEnabled) {
      // Check if 2FA token is provided
      const twoFactorToken = req.headers['x-2fa-token'] || req.body.twoFactorToken;
      
      if (!twoFactorToken) {
        res.status(403).json(new ApiResponse(403, 'Two-factor authentication required'));
        return;
      }

      // Verify 2FA token (implementation depends on your 2FA method)
      const isValid2FA = await verifyTwoFactorToken(user.id, twoFactorToken);
      
      if (!isValid2FA) {
        res.status(403).json(new ApiResponse(403, 'Invalid two-factor authentication token'));
        return;
      }
    }

    next();
  } catch (error) {
    logger.error('2FA check error:', error);
    res.status(500).json(new ApiResponse(500, 'Server error during 2FA check'));
  }
};

/**
 * KYC verification middleware
 */
export const requireKYC = (requiredStatus: 'verified' | 'pending' | 'rejected' = 'verified') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(new ApiResponse(401, 'Not authenticated'));
        return;
      }

      const user = await User.findByPk(req.user.id);
      
      if (!user) {
        res.status(401).json(new ApiResponse(401, 'User not found'));
        return;
      }

      if (user.role === 'company' && user.kycStatus !== requiredStatus) {
        const statusMap = {
          verified: 'KYC verified',
          pending: 'KYC pending review',
          rejected: 'KYC rejected'
        };
        
        res.status(403).json(
          new ApiResponse(403, `${statusMap[user.kycStatus]}. Required status: ${requiredStatus}`)
        );
        return;
      }

      next();
    } catch (error) {
      logger.error('KYC check error:', error);
      res.status(500).json(new ApiResponse(500, 'Server error during KYC check'));
    }
  };
};

/**
 * Rate limiting for specific user actions
 */
export const userActionLimiter = (action: string, maxAttempts: number, windowMs: number) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json(new ApiResponse(401, 'Not authenticated'));
        return;
      }

      const key = `rate_limit:${req.user.id}:${action}`;
      const attempts = await redisClient.get(key);
      
      if (attempts && parseInt(attempts) >= maxAttempts) {
        res.status(429).json(
          new ApiResponse(429, `Too many ${action} attempts. Please try again later.`)
        );
        return;
      }

      // Increment counter
      if (!attempts) {
        await redisClient.setEx(key, Math.floor(windowMs / 1000), '1');
      } else {
        await redisClient.incr(key);
      }

      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // Allow request to proceed on Redis error
      next();
    }
  };
};

/**
 * Validate API key for external services
 */
export const validateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      res.status(401).json(new ApiResponse(401, 'API key required'));
      return;
    }

    // Validate API key (store in database or environment)
    const validApiKey = process.env.API_KEY;
    
    if (apiKey !== validApiKey) {
      logger.warn(`Invalid API key attempt: ${req.ip} - ${req.method} ${req.originalUrl}`);
      res.status(401).json(new ApiResponse(401, 'Invalid API key'));
      return;
    }

    // Optional: Track API usage
    await redisClient.incr(`api_usage:${req.ip}:${new Date().toISOString().split('T')[0]}`);

    next();
  } catch (error) {
    logger.error('API key validation error:', error);
    res.status(500).json(new ApiResponse(500, 'Server error during API key validation'));
  }
};

/**
 * CORS middleware for WebSocket connections
 */
export const socketAuth = async (socket: any, next: (err?: Error) => void): Promise<void> => {
  try {
    const token = socket.handshake.auth.token || 
                 socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    if (!user.isActive) {
      return next(new Error('Authentication error: Account deactivated'));
    }

    // Attach user to socket
    socket.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      companyId: user.companyId
    };

    logger.debug(`Socket authenticated: ${user.id} - ${user.email}`);
    next();
  } catch (error: any) {
    logger.error('Socket authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      next(new Error('Authentication error: Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new Error('Authentication error: Token expired'));
    } else {
      next(new Error('Authentication error: Failed to authenticate'));
    }
  }
};

// Helper function for 2FA verification (placeholder)
async function verifyTwoFactorToken(userId: string, token: string): Promise<boolean> {
  // Implement your 2FA verification logic here
  // This could be TOTP, SMS code, email code, etc.
  const storedToken = await redisClient.get(`2fa:${userId}`);
  return storedToken === token;
}

export default {
  protect,
  authorize,
  isOwner,
  require2FA,
  requireKYC,
  userActionLimiter,
  validateApiKey,
  socketAuth
};