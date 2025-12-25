import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { logger } from './logger';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * API Response Class
 */
export class ApiResponse {
  public success: boolean;
  public timestamp: string;

  constructor(
    public statusCode: number,
    public message: string,
    public data: any = null,
    public errors: any[] = []
  ) {
    this.success = statusCode >= 200 && statusCode < 300;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      success: this.success,
      statusCode: this.statusCode,
      message: this.message,
      data: this.data,
      errors: this.errors,
      timestamp: this.timestamp
    };
  }

  static success(message: string, data: any = null, statusCode: number = 200) {
    return new ApiResponse(statusCode, message, data);
  }

  static error(message: string, errors: any[] = [], statusCode: number = 500) {
    return new ApiResponse(statusCode, message, null, errors);
  }

  static validationError(errors: any[]) {
    return new ApiResponse(400, 'Validation failed', null, errors);
  }

  static notFound(message: string = 'Resource not found') {
    return new ApiResponse(404, message);
  }

  static unauthorized(message: string = 'Not authorized') {
    return new ApiResponse(401, message);
  }

  static forbidden(message: string = 'Access forbidden') {
    return new ApiResponse(403, message);
  }

  static conflict(message: string = 'Resource already exists') {
    return new ApiResponse(409, message);
  }

  static badRequest(message: string = 'Bad request') {
    return new ApiResponse(400, message);
  }

  static internalError(message: string = 'Internal server error') {
    return new ApiResponse(500, message);
  }
}

/**
 * Async handler wrapper for Express routes
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validate request using express-validator
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json(ApiResponse.validationError(errorMessages));
  }
  next();
};

/**
 * Generate random string
 */
export const generateRandomString = (length: number = 32): string => {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};

/**
 * Generate secure token
 */
export const generateToken = (length: number = 64): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generate JWT token
 */
export const generateJWT = (payload: object, expiresIn: string = '7d'): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn });
};

/**
 * Verify JWT token
 */
export const verifyJWT = <T = JwtPayload>(token: string): T => {
  return jwt.verify(token, process.env.JWT_SECRET!) as T;
};

/**
 * Decode JWT token without verification
 */
export const decodeJWT = <T = JwtPayload>(token: string): T => {
  return jwt.decode(token) as T;
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): JwtPayload => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
};

/**
 * Format currency
 */
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format date
 */
export const formatDate = (date: Date | string, format: string = 'medium'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {};
  
  switch (format) {
    case 'short':
      options.year = 'numeric';
      options.month = 'short';
      options.day = 'numeric';
      break;
    case 'medium':
      options.year = 'numeric';
      options.month = 'long';
      options.day = 'numeric';
      options.hour = '2-digit';
      options.minute = '2-digit';
      break;
    case 'long':
      options.weekday = 'long';
      options.year = 'numeric';
      options.month = 'long';
      options.day = 'numeric';
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
      break;
    case 'date':
      options.year = 'numeric';
      options.month = 'long';
      options.day = 'numeric';
      break;
    case 'time':
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
      break;
    default:
      options.year = 'numeric';
      options.month = '2-digit';
      options.day = '2-digit';
      options.hour = '2-digit';
      options.minute = '2-digit';
  }
  
  return dateObj.toLocaleDateString('en-US', options);
};

/**
 * Calculate time ago
 */
export const timeAgo = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
  
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
  
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
  
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
  
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
  
  return 'just now';
};

/**
 * Sanitize input
 */
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/[&<>"']/g, '') // Remove special characters
    .substring(0, 5000); // Limit length
};

/**
 * Validate email
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
};

/**
 * Validate URL
 */
export const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Generate slug from string
 */
export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Truncate text
 */
export const truncateText = (text: string, maxLength: number = 100): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

/**
 * Paginate array
 */
export const paginate = <T>(array: T[], page: number = 1, limit: number = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const results = array.slice(startIndex, endIndex);
  
  return {
    data: results,
    page,
    limit,
    total: array.length,
    totalPages: Math.ceil(array.length / limit),
    hasNext: endIndex < array.length,
    hasPrev: startIndex > 0
  };
};

/**
 * Calculate percentage
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

/**
 * Generate UUID
 */
export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Deep clone object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Merge objects deeply
 */
export const deepMerge = (target: any, source: any): any => {
  const output = Object.assign({}, target);
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
};

/**
 * Check if value is object
 */
export const isObject = (item: any): boolean => {
  return item && typeof item === 'object' && !Array.isArray(item);
};

/**
 * Remove null/undefined values from object
 */
export const removeEmptyValues = (obj: any): any => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  );
};

/**
 * Delay execution
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      logger.warn(`Attempt ${i + 1} failed: ${error.message}`);
      
      if (i < maxRetries - 1) {
        await delay(delayMs * Math.pow(2, i)); // Exponential backoff
      }
    }
  }
  
  throw lastError!;
};

/**
 * Cache wrapper function
 */
export const withCache = <T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 300
) => {
  return async (): Promise<T> => {
    // This would typically use Redis or another cache
    // For now, we'll just call the function directly
    return await fn();
  };
};

/**
 * Generate file name with timestamp
 */
export const generateFileName = (originalName: string): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const extension = originalName.split('.').pop();
  return `${timestamp}_${randomString}.${extension}`;
};

/**
 * Validate file type
 */
export const validateFileType = (file: Express.Multer.File, allowedTypes: string[]): boolean => {
  return allowedTypes.includes(file.mimetype);
};

/**
 * Validate file size
 */
export const validateFileSize = (file: Express.Multer.File, maxSizeMB: number): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * Get client IP address
 */
export const getClientIP = (req: Request): string => {
  return req.ip || 
         req.headers['x-forwarded-for'] as string || 
         req.socket.remoteAddress || 
         'unknown';
};

/**
 * Get user agent
 */
export const getUserAgent = (req: Request): string => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Log API request
 */
export const logRequest = (req: Request): void => {
  const ip = getClientIP(req);
  const userAgent = getUserAgent(req);
  const method = req.method;
  const url = req.originalUrl;
  const userId = (req as any).user?.id || 'anonymous';
  
  logger.http(`${method} ${url} - IP: ${ip} - User: ${userId} - Agent: ${userAgent}`);
};

/**
 * Log API response
 */
export const logResponse = (req: Request, res: Response, startTime: number): void => {
  const duration = Date.now() - startTime;
  const method = req.method;
  const url = req.originalUrl;
  const statusCode = res.statusCode;
  const userId = (req as any).user?.id || 'anonymous';
  
  const logLevel = statusCode >= 500 ? 'error' : 
                   statusCode >= 400 ? 'warn' : 'http';
  
  logger[logLevel](`${method} ${url} - ${statusCode} - ${duration}ms - User: ${userId}`);
};

/**
 * Request logger middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log request
  logRequest(req);
  
  // Log response when finished
  res.on('finish', () => {
    logResponse(req, res, startTime);
  });
  
  next();
};

export default {
  ApiResponse,
  asyncHandler,
  validateRequest,
  generateRandomString,
  generateToken,
  hashPassword,
  comparePassword,
  generateJWT,
  verifyJWT,
  decodeJWT,
  generateRefreshToken,
  verifyRefreshToken,
  formatCurrency,
  formatDate,
  timeAgo,
  sanitizeInput,
  isValidEmail,
  isValidPhone,
  isValidURL,
  generateSlug,
  truncateText,
  paginate,
  calculatePercentage,
  generateUUID,
  deepClone,
  deepMerge,
  isObject,
  removeEmptyValues,
  delay,
  retry,
  withCache,
  generateFileName,
  validateFileType,
  validateFileSize,
  getClientIP,
  getUserAgent,
  logRequest,
  logResponse,
  requestLogger
};