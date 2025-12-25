import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiResponse } from '../utils/helpers';
import User from '../database/models/User';

// Fix: Change res type to any to solve Property 'status' does not exist error
export const protect = async (req: any, res: any, next: NextFunction) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json(new ApiResponse(401, 'Not authorized to access this route'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = await (User as any).findByPk(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json(new ApiResponse(401, 'Not authorized to access this route'));
  }
};

// Fix: Change res type to any to solve Property 'status' does not exist error
export const authorize = (...roles: string[]) => {
  return (req: any, res: any, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json(new ApiResponse(403, `User role ${req.user.role} is not authorized`));
    }
    next();
  };
};