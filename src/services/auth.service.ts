import bcrypt from 'bcryptjs';
import User from '../database/models/User';
import { ApiResponse } from '../utils/helpers';
import { logger } from '../utils/logger';

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'admin' | 'company' | 'bidder';
  companyDetails?: any;
}

export class AuthService {
  public static async findUserByEmail(email: string): Promise<User | null> {
    try {
      return await User.findOne({ where: { email } });
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  public static async findUserById(id: string): Promise<User | null> {
    try {
      return await User.findByPk(id);
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  public static async registerUser(data: RegisterData): Promise<User> {
    try {
      const userData: any = {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role
      };

      // If user is a company, create company record
      if (data.role === 'company' && data.companyDetails) {
        // Here you would create a company record
        // For now, we'll just store companyDetails in metadata
        userData.companyDetails = data.companyDetails;
      }

      const user = await User.create(userData);
      logger.info(`User registered: ${user.email} (${user.role})`);
      
      return user;
    } catch (error) {
      logger.error('Error registering user:', error);
      throw new ApiResponse(500, 'Registration failed');
    }
  }

  public static async authenticateUser(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.findUserByEmail(email);
      
      if (!user) {
        return null;
      }

      // Check if account is active
      if (!user.isActive) {
        throw new ApiResponse(403, 'Account is deactivated');
      }

      // Check if account is locked
      if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
        const remainingTime = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 1000 / 60);
        throw new ApiResponse(423, `Account locked. Try again in ${remainingTime} minutes`);
      }

      const isValidPassword = await user.comparePassword(password);
      
      if (!isValidPassword) {
        // Increment failed login attempts
        await user.incrementLoginAttempts();
        
        const remainingAttempts = 5 - user.loginAttempts;
        if (remainingAttempts > 0) {
          throw new ApiResponse(401, `Invalid password. ${remainingAttempts} attempts remaining`);
        } else {
          throw new ApiResponse(423, 'Account locked due to too many failed attempts');
        }
      }

      // Reset login attempts on successful login
      user.resetLoginAttempts();
      await user.save();

      return user;
    } catch (error) {
      if (error instanceof ApiResponse) {
        throw error;
      }
      logger.error('Error authenticating user:', error);
      throw new ApiResponse(500, 'Authentication failed');
    }
  }

  public static async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    try {
      const user = await this.findUserById(userId);
      
      if (!user) {
        throw new ApiResponse(404, 'User not found');
      }

      await user.update(updateData);
      await user.reload();

      return user;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  public static async verifyEmail(userId: string): Promise<void> {
    try {
      const user = await this.findUserById(userId);
      
      if (!user) {
        throw new ApiResponse(404, 'User not found');
      }

      user.emailVerified = true;
      await user.save();
    } catch (error) {
      logger.error('Error verifying email:', error);
      throw error;
    }
  }

  public static async resetPassword(email: string, newPassword: string): Promise<void> {
    try {
      const user = await this.findUserByEmail(email);
      
      if (!user) {
        throw new ApiResponse(404, 'User not found');
      }

      user.password = newPassword;
      await user.save();
      
      logger.info(`Password reset for user: ${user.email}`);
    } catch (error) {
      logger.error('Error resetting password:', error);
      throw error;
    }
  }
}

export const authService = AuthService;