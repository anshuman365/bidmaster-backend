
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/helpers';
import redisClient from '../config/redis';

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Fix: Cast req to any to resolve body and validationResult errors
      const _req = req as any;
      const _res = res as any;
      const errors = validationResult(_req);
      if (!errors.isEmpty()) { throw new ApiResponse(400, 'Validation failed', { errors: errors.array() }); }
      const { email, password, firstName, lastName, phone, role, companyDetails } = _req.body;
      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) { throw new ApiResponse(409, 'User already exists'); }
      const user = await authService.registerUser({ email, password, firstName, lastName, phone, role, companyDetails });
      const accessToken = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();
      await redisClient.setex(`refresh_token:${user.id}`, 30 * 24 * 60 * 60, refreshToken);
      // Fix: Use _res to access status() and json()
      _res.status(201).json(new ApiResponse(201, 'Registration successful', { user: user.toJSON(), tokens: { accessToken, refreshToken, expiresIn: 7 * 24 * 60 * 60 } }));
    } catch (error) { next(error); }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Fix: Cast req to any to resolve body errors
      const _req = req as any;
      const _res = res as any;
      const { email, password, deviceInfo } = _req.body;
      const user = await authService.authenticateUser(email, password);
      if (!user) { throw new ApiResponse(401, 'Invalid credentials'); }
      user.lastLogin = new Date();
      await user.save();
      const accessToken = user.generateAuthToken();
      const refreshToken = user.generateRefreshToken();
      await redisClient.setex(`refresh_token:${user.id}`, 30 * 24 * 60 * 60, refreshToken);
      // Fix: Use _res to access json()
      _res.json(new ApiResponse(200, 'Login successful', { user: user.toJSON(), tokens: { accessToken, refreshToken, expiresIn: 7 * 24 * 60 * 60 } }));
    } catch (error) { next(error); }
  }
}

export default AuthController;
