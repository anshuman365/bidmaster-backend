import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/helpers';
import redisClient from '../config/redis';

interface RegisterBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'admin' | 'company' | 'bidder';
  companyDetails?: any;
}

interface LoginBody {
  email: string;
  password: string;
  deviceInfo?: any;
}

interface CustomRequest<T> extends Request {
  body: T;
}

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const { email, password, firstName, lastName, phone, role, companyDetails } = req.body as RegisterBody;
      
      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        throw new ApiResponse(409, 'User already exists');
      }

      const user = await authService.registerUser({ 
        email, 
        password, 
        firstName, 
        lastName, 
        phone, 
        role, 
        companyDetails 
      });

      const accessToken = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();

      // Store refresh token in Redis
      await redisClient.setEx(
        `refresh_token:${user.id}`, 
        30 * 24 * 60 * 60, // 30 days
        refreshToken
      );

      logger.info(`User registered: ${user.email}`);

      res.status(201).json(
        new ApiResponse(201, 'Registration successful', { 
          user: user.toJSON(), 
          tokens: { 
            accessToken, 
            refreshToken, 
            expiresIn: 7 * 24 * 60 * 60 
          } 
        })
      );
    } catch (error) { 
      next(error); 
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const { email, password, deviceInfo } = req.body as LoginBody;
      const user = await authService.authenticateUser(email, password);

      if (!user) {
        throw new ApiResponse(401, 'Invalid credentials');
      }

      // Check if account is locked
      if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
        const remainingTime = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 1000 / 60);
        throw new ApiResponse(423, `Account locked. Try again in ${remainingTime} minutes`);
      }

      // Update last login and reset attempts
      user.lastLogin = new Date();
      user.resetLoginAttempts();
      await (user as any).save();

      const accessToken = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();

      // Store refresh token in Redis
      await redisClient.setEx(
        `refresh_token:${user.id}`,
        30 * 24 * 60 * 60,
        refreshToken
      );

      logger.info(`User logged in: ${user.email}`);

      res.json(
        new ApiResponse(200, 'Login successful', { 
          user: user.toJSON(), 
          tokens: { 
            accessToken, 
            refreshToken, 
            expiresIn: 7 * 24 * 60 * 60 
          },
          deviceInfo
        })
      );
    } catch (error) { 
      next(error); 
    }
  }

  public static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      res.json(new ApiResponse(200, 'Profile fetched successfully', user.toJSON()));
    } catch (error) {
      next(error);
    }
  }

  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const updateData = req.body;

      // Remove sensitive fields
      delete updateData.password;
      delete updateData.role;
      delete updateData.id;

      await (user as any).update(updateData);
      await (user as any).reload();

      res.json(new ApiResponse(200, 'Profile updated successfully', user.toJSON()));
    } catch (error) {
      next(error);
    }
  }

  public static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        throw new ApiResponse(400, 'Refresh token required');
      }

      const decoded = require('jsonwebtoken').verify(
        refreshToken, 
        process.env.JWT_REFRESH_SECRET!
      ) as any;

      const storedToken = await redisClient.get(`refresh_token:${decoded.id}`);
      
      if (storedToken !== refreshToken) {
        throw new ApiResponse(401, 'Invalid refresh token');
      }

      const user = await authService.findUserById(decoded.id);
      
      if (!user) {
        throw new ApiResponse(404, 'User not found');
      }

      const newAccessToken = user.generateAuthToken();
      const newRefreshToken = user.generateRefreshToken();

      // Update refresh token in Redis
      await redisClient.setEx(
        `refresh_token:${user.id}`,
        30 * 24 * 60 * 60,
        newRefreshToken
      );

      res.json(
        new ApiResponse(200, 'Token refreshed', {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: 7 * 24 * 60 * 60
        })
      );
    } catch (error) {
      next(error);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      
      // Remove refresh token from Redis
      await redisClient.del(`refresh_token:${user.id}`);

      res.json(new ApiResponse(200, 'Logged out successfully'));
    } catch (error) {
      next(error);
    }
  }
}