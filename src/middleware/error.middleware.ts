import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/helpers';

interface ErrorWithStatus extends Error {
  statusCode?: number;
  status?: string;
  isOperational?: boolean;
  errors?: any[];
}

export const errorHandler = (
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;
  
  // Log the error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user: (req as any).user?.id
  });

  // Mongoose/ObjectId cast error
  if (err.name === 'CastError') {
    const message = `Resource not found with id of ${(err as any).value}`;
    error = new ApiResponse(404, message) as any;
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    const value = (err as any).keyValue[field];
    const message = `Duplicate field value: ${value}. Please use another value.`;
    error = new ApiResponse(400, message) as any;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((val: any) => val.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    error = new ApiResponse(400, message) as any;
  }

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    const errors = (err as any).errors.map((e: any) => e.message);
    const message = `Validation error: ${errors.join('. ')}`;
    error = new ApiResponse(400, message) as any;
  }

  // Sequelize unique constraint error
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = (err as any).errors[0]?.path;
    const message = `Duplicate value for field: ${field}. Please use another value.`;
    error = new ApiResponse(400, message) as any;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again.';
    error = new ApiResponse(401, message) as any;
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your token has expired. Please log in again.';
    error = new ApiResponse(401, message) as any;
  }

  // Send response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  if (process.env.NODE_ENV === 'production') {
    res.status(statusCode).json({
      success: false,
      message,
      ...(statusCode === 500 && { error: 'Internal Server Error' })
    });
  } else {
    res.status(statusCode).json({
      success: false,
      message,
      error: err,
      stack: err.stack
    });
  }
};

// Async handler wrapper to catch async errors
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler middleware
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApiResponse(404, `Not Found - ${req.originalUrl}`) as any;
  next(error);
};