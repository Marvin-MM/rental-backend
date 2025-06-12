
import { logActivity } from '../services/auditService.js';
import logger from '../config/logger.js';

export const auditMiddleware = (action, resourceType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Only log on successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            const resourceId = req.params.id || req.body?.id || 'unknown';
            await logActivity(
              action,
              req.user?.userId,
              resourceType,
              resourceId,
              {
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                method: req.method,
                url: req.originalUrl,
                body: req.method !== 'GET' ? req.body : undefined
              }
            );
          } catch (error) {
            logger.error('Error in audit middleware:', error);
          }
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

export const auditLogin = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    if (res.statusCode === 200) {
      setImmediate(async () => {
        try {
          const parsedData = JSON.parse(data);
          if (parsedData.user) {
            await logActivity(
              'LOGIN',
              parsedData.user.id,
              'USER',
              parsedData.user.id,
              {
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                email: parsedData.user.email
              }
            );
          }
        } catch (error) {
          logger.error('Error in login audit:', error);
        }
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};
