
import rateLimit from 'express-rate-limit';
import ExpressBrute from 'express-brute';
import helmet from 'helmet';
import logger from '../config/logger.js';

// Brute force protection for login attempts
const bruteStore = new ExpressBrute.MemoryStore();
export const loginBruteForce = new ExpressBrute(bruteStore, {
  freeRetries: 5,
  minWait: 5 * 60 * 1000, // 5 minutes
  maxWait: 60 * 60 * 1000, // 1 hour
  lifetime: 24 * 60 * 60, // 24 hours
  failCallback: (req, res, next, nextValidRequestDate) => {
    logger.warn(`Brute force attempt detected from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many failed attempts',
      message: `Try again after ${new Date(nextValidRequestDate)}`,
      retryAfter: nextValidRequestDate
    });
  }
});

// Rate limiting for sensitive operations
export const sensitiveOperationLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded for sensitive operations'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Parameter pollution prevention
export const preventParameterPollution = (req, res, next) => {
  const pollutionKeys = ['id', 'email', 'role'];
  
  for (const key of pollutionKeys) {
    if (Array.isArray(req.query[key])) {
      req.query[key] = req.query[key][0];
    }
    if (Array.isArray(req.body[key])) {
      req.body[key] = req.body[key][0];
    }
  }
  
  next();
};

// CSRF protection
export const csrfProtection = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body.csrfToken;
    const sessionToken = req.session?.csrfToken;
    
    if (!token || token !== sessionToken) {
      return res.status(403).json({
        error: 'CSRF token mismatch',
        message: 'Invalid or missing CSRF token'
      });
    }
  }
  
  next();
};

// Security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input sanitization
export const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].trim();
        // Remove potential XSS patterns
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};
