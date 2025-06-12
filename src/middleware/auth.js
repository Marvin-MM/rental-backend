
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import logger from '../config/logger.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        tenant: true,
        owner: true,
        manager: {
          include: {
            owner: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid token or user inactive',
      });
    }

    req.user = {
      ...user,
      userId: user.id,
    };
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({
      error: 'Access denied',
      message: 'Invalid token',
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'User not authenticated',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

export const checkPermissions = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'User not authenticated',
      });
    }

    // Super admin and owners have all permissions
    if (['SUPER_ADMIN', 'OWNER'].includes(req.user.role)) {
      return next();
    }

    // Check manager permissions
    if (req.user.role === 'MANAGER' && req.user.manager) {
      const userPermissions = req.user.manager.permissions || {};
      const hasPermission = requiredPermissions.every(permission => 
        userPermissions[permission] === true
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
    }

    next();
  };
};
