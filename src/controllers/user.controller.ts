import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../utils/helpers';
import { logger } from '../utils/logger';
import { validationResult } from 'express-validator';
import User from '../database/models/User';

export class UserController {
  // Get user profile
  public static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      
      res.json(new ApiResponse(200, 'Profile fetched successfully', user.toJSON()));
    } catch (error) {
      next(error);
    }
  }

  // Update user profile
  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const user = (req as any).user;
      const updateData = req.body;

      // Remove fields that shouldn't be updated directly
      delete updateData.id;
      delete updateData.email;
      delete updateData.role;
      delete updateData.password;
      delete updateData.companyId;

      const updatedUser = await authService.updateUser(user.id, updateData);
      
      logger.info(`User profile updated: ${user.id}`);
      
      res.json(new ApiResponse(200, 'Profile updated successfully', updatedUser.toJSON()));
    } catch (error) {
      next(error);
    }
  }

  // Change password
  public static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const user = (req as any).user;
      const { currentPassword, newPassword } = req.body;

      // Verify current password
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        throw new ApiResponse(401, 'Current password is incorrect');
      }

      // Update password
      user.password = newPassword;
      await user.save();
      
      logger.info(`Password changed for user: ${user.id}`);
      
      res.json(new ApiResponse(200, 'Password changed successfully'));
    } catch (error) {
      next(error);
    }
  }

  // Upload profile picture
  public static async uploadProfilePicture(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const file = req.file;

      if (!file) {
        throw new ApiResponse(400, 'No file uploaded');
      }

      // In a real app, upload to cloud storage (AWS S3, Cloudinary, etc.)
      // For now, we'll just save the path
      const profilePicture = `/uploads/profiles/${file.filename}`;
      
      await user.update({ profilePicture });
      
      logger.info(`Profile picture uploaded for user: ${user.id}`);
      
      res.json(new ApiResponse(200, 'Profile picture uploaded successfully', { profilePicture }));
    } catch (error) {
      next(error);
    }
  }

  // Get user stats
  public static async getUserStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;

      // In a real app, fetch stats from database
      const stats = {
        totalAuctions: 5,
        auctionsWon: 2,
        totalBids: 15,
        activeBids: 3,
        totalSpent: 25000,
        memberSince: user.createdAt
      };

      res.json(new ApiResponse(200, 'User stats fetched', stats));
    } catch (error) {
      next(error);
    }
  }

  // Get user notifications
  public static async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const { limit = 20, offset = 0 } = req.query;

      // In a real app, fetch notifications from database
      const notifications = [
        {
          id: 'notif_1',
          type: 'bid_won',
          title: 'You won an auction!',
          message: 'Congratulations! You won the auction for "Industrial Generator"',
          read: false,
          createdAt: new Date(),
          metadata: { auctionId: 'auc_123' }
        },
        {
          id: 'notif_2',
          type: 'outbid',
          title: 'You were outbid',
          message: 'Someone placed a higher bid on "Vintage Truck"',
          read: true,
          createdAt: new Date(Date.now() - 3600000),
          metadata: { auctionId: 'auc_456' }
        }
      ];

      res.json(new ApiResponse(200, 'Notifications fetched', {
        notifications,
        unreadCount: notifications.filter(n => !n.read).length
      }));
    } catch (error) {
      next(error);
    }
  }

  // Mark notification as read
  public static async markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notificationId } = req.params;
      
      // In a real app, update notification in database
      logger.info(`Notification marked as read: ${notificationId}`);
      
      res.json(new ApiResponse(200, 'Notification marked as read'));
    } catch (error) {
      next(error);
    }
  }

  // Update user settings
  public static async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const settings = req.body;

      // Validate settings structure
      if (settings.notifications) {
        user.settings.notifications = {
          ...user.settings.notifications,
          ...settings.notifications
        };
      }

      if (settings.privacy) {
        user.settings.privacy = {
          ...user.settings.privacy,
          ...settings.privacy
        };
      }

      await user.save();
      
      logger.info(`Settings updated for user: ${user.id}`);
      
      res.json(new ApiResponse(200, 'Settings updated successfully', user.settings));
    } catch (error) {
      next(error);
    }
  }

  // Get user activity log
  public static async getActivityLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const { limit = 50, offset = 0 } = req.query;

      // In a real app, fetch activity log from database
      const activities = [
        {
          id: 'act_1',
          action: 'bid_placed',
          description: 'Placed bid of ₹15,000 on "Industrial Generator"',
          timestamp: new Date(),
          metadata: { auctionId: 'auc_123', amount: 15000 }
        },
        {
          id: 'act_2',
          action: 'login',
          description: 'Logged in from new device',
          timestamp: new Date(Date.now() - 86400000),
          metadata: { ip: '192.168.1.1', device: 'Chrome on Windows' }
        }
      ];

      res.json(new ApiResponse(200, 'Activity log fetched', activities));
    } catch (error) {
      next(error);
    }
  }

  // Request account deletion
  public static async requestAccountDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const { reason } = req.body;

      // In a real app, create deletion request and send confirmation email
      logger.warn(`Account deletion requested for user: ${user.id}, Reason: ${reason}`);
      
      res.json(new ApiResponse(200, 'Account deletion request submitted. We will contact you shortly.'));
    } catch (error) {
      next(error);
    }
  }

  // Verify email
  public static async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      
      // In a real app, verify token and update user
      logger.info(`Email verification attempt with token: ${token}`);
      
      res.json(new ApiResponse(200, 'Email verified successfully'));
    } catch (error) {
      next(error);
    }
  }

  // Resend verification email
  public static async resendVerificationEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      
      // In a real app, send verification email
      logger.info(`Verification email resent for user: ${user.id}`);
      
      res.json(new ApiResponse(200, 'Verification email sent'));
    } catch (error) {
      next(error);
    }
  }

  // Get user addresses
  public static async getAddresses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;

      const addresses = user.address ? [user.address] : [];
      
      res.json(new ApiResponse(200, 'Addresses fetched', addresses));
    } catch (error) {
      next(error);
    }
  }

  // Add/update address
  public static async updateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiResponse(400, 'Validation failed', { errors: errors.array() });
      }

      const user = (req as any).user;
      const address = req.body;

      user.address = address;
      await user.save();
      
      logger.info(`Address updated for user: ${user.id}`);
      
      res.json(new ApiResponse(200, 'Address updated successfully', user.address));
    } catch (error) {
      next(error);
    }
  }
}