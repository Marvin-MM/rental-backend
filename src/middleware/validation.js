import { validationResult, body, query } from 'express-validator';
import { ZodError } from 'zod';
import logger from '../config/logger.js';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', errors.array());
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Invalid input data',
      details: errors.array(),
    });
  }
  next();
};

export const zodValidate = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Zod validation errors:', error.errors);
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input data',
          details: error.errors,
        });
      }
      next(error);
    }
  };
};

// Sanitize input to prevent parameter pollution
export const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (const key in obj) {
      if (Array.isArray(obj[key]) && obj[key].length === 1) {
        obj[key] = obj[key][0];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.query) sanitize(req.query);
  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);

  next();
};

// Property validations
export const validateProperty = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Property name must be between 2 and 100 characters'),
  body('address').trim().isLength({ min: 5, max: 200 }).withMessage('Address must be between 5 and 200 characters'),
  body('type').isIn(['APARTMENT', 'HOUSE', 'CONDO', 'TOWNHOUSE', 'STUDIO', 'OTHER']).withMessage('Invalid property type'),
  body('units').optional().isInt({ min: 1 }).withMessage('Units must be a positive integer'),
  body('rentAmount').isFloat({ min: 0 }).withMessage('Rent amount must be a positive number'),
  body('amenities').optional().isArray().withMessage('Amenities must be an array'),
  handleValidationErrors,
];

export const validatePropertyUpdate = [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Property name must be between 2 and 100 characters'),
  body('address').optional().trim().isLength({ min: 5, max: 200 }).withMessage('Address must be between 5 and 200 characters'),
  body('type').optional().isIn(['APARTMENT', 'HOUSE', 'CONDO', 'TOWNHOUSE', 'STUDIO', 'OTHER']).withMessage('Invalid property type'),
  body('units').optional().isInt({ min: 1 }).withMessage('Units must be a positive integer'),
  body('rentAmount').optional().isFloat({ min: 0 }).withMessage('Rent amount must be a positive number'),
  body('status').optional().isIn(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'UNAVAILABLE']).withMessage('Invalid status'),
  body('amenities').optional().isArray().withMessage('Amenities must be an array'),
  handleValidationErrors,
];

// Tenant validations
export const validateTenant = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('phone').isMobilePhone().withMessage('Please provide a valid phone number'),
  body('propertyId').isUUID().withMessage('Property ID must be a valid UUID'),
  body('emergencyContact').optional().isObject().withMessage('Emergency contact must be an object'),
  body('moveInDate').optional().isISO8601().withMessage('Move in date must be a valid date'),
  handleValidationErrors,
];

export const validateTenantUpdate = [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('emergencyContact').optional().isObject().withMessage('Emergency contact must be an object'),
  body('moveInDate').optional().isISO8601().withMessage('Move in date must be a valid date'),
  handleValidationErrors,
];

// Manager validations
export const validateManager = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('permissions').optional().isObject().withMessage('Permissions must be an object'),
  handleValidationErrors,
];

export const validateManagerUpdate = [
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('permissions').optional().isObject().withMessage('Permissions must be an object'),
  handleValidationErrors,
];

// Lease validations
export const validateLease = [
  body('tenantId').isUUID().withMessage('Tenant ID must be a valid UUID'),
  body('propertyId').isUUID().withMessage('Property ID must be a valid UUID'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('rentAmount').isFloat({ min: 0 }).withMessage('Rent amount must be a positive number'),
  body('securityDeposit').optional().isFloat({ min: 0 }).withMessage('Security deposit must be a positive number'),
  body('terms').optional().isString().withMessage('Terms must be a string'),
  handleValidationErrors,
];

export const validateLeaseUpdate = [
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  body('rentAmount').optional().isFloat({ min: 0 }).withMessage('Rent amount must be a positive number'),
  body('securityDeposit').optional().isFloat({ min: 0 }).withMessage('Security deposit must be a positive number'),
  body('status').optional().isIn(['ACTIVE', 'EXPIRED', 'TERMINATED', 'PENDING']).withMessage('Invalid lease status'),
  body('terms').optional().isString().withMessage('Terms must be a string'),
  handleValidationErrors,
];

// Analytics validations
export const validateAnalyticsQuery = [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('propertyId').optional().isUUID().withMessage('Property ID must be a valid UUID'),
  query('period').optional().isIn(['daily', 'weekly', 'monthly', 'yearly']).withMessage('Invalid period'),
  handleValidationErrors,
];

// Notification validations
export const validateNotification = [
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('type').isIn(['PAYMENT_REMINDER', 'LEASE_EXPIRY', 'MAINTENANCE_UPDATE', 'COMPLAINT_UPDATE', 'GENERAL']).withMessage('Invalid notification type'),
  body('userId').optional().isUUID().withMessage('User ID must be a valid UUID'),
  body('recipientType').optional().isIn(['USER', 'ROLE', 'ALL']).withMessage('Invalid recipient type'),
  body('recipientValue').optional().isString().withMessage('Recipient value must be a string'),
  handleValidationErrors,
];

// Device token validation
export const validateDeviceToken = [
  body('token').notEmpty().withMessage('Device token is required'),
  body('platform').isIn(['ios', 'android', 'web']).withMessage('Invalid platform'),
  handleValidationErrors,
];

// Bulk operations validation
export const validateBulkOperation = [
  body('ids').isArray({ min: 1 }).withMessage('IDs array is required and must not be empty'),
  body('ids.*').isUUID().withMessage('Each ID must be a valid UUID'),
  body('action').notEmpty().withMessage('Action is required'),
  handleValidationErrors,
];

// Payment validations
export const validatePayment = [
  body('leaseId').isUUID().withMessage('Lease ID must be a valid UUID'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('dueDate').isISO8601().withMessage('Due date must be a valid date'),
  body('method').optional().isIn(['ONLINE', 'CASH', 'CHECK', 'BANK_TRANSFER']).withMessage('Invalid payment method'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  handleValidationErrors,
];

export const validatePaymentUpdate = [
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
  body('paidDate').optional().isISO8601().withMessage('Paid date must be a valid date'),
  body('method').optional().isIn(['ONLINE', 'CASH', 'CHECK', 'BANK_TRANSFER']).withMessage('Invalid payment method'),
  body('status').optional().isIn(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']).withMessage('Invalid payment status'),
  body('transactionId').optional().isString().withMessage('Transaction ID must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  handleValidationErrors,
];

// Complaint validations
export const validateComplaint = [
  body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('category').isIn(['MAINTENANCE', 'NOISE', 'PEST_CONTROL', 'SAFETY', 'OTHER']).withMessage('Invalid complaint category'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority level'),
  body('propertyId').optional().isUUID().withMessage('Property ID must be a valid UUID'),
  handleValidationErrors,
];

export const validateComplaintUpdate = [
  body('title').optional().trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
  body('description').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('category').optional().isIn(['MAINTENANCE', 'NOISE', 'PEST_CONTROL', 'SAFETY', 'OTHER']).withMessage('Invalid complaint category'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority level'),
  body('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).withMessage('Invalid complaint status'),
  handleValidationErrors,
];

export const validateMaintenanceRequest = (req, res, next) => {
  const maintenanceRequestSchema = z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().min(1, 'Description is required'),
    category: z.enum(['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'STRUCTURAL', 'OTHER']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    propertyId: z.string().cuid(),
  });

  validateSchema(maintenanceRequestSchema)(req, res, next);
};

export const validateMaintenanceUpdate = (req, res, next) => {
  const maintenanceUpdateSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().min(1).optional(),
    category: z.enum(['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'STRUCTURAL', 'OTHER']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    resolution: z.string().optional(),
  });

  validateSchema(maintenanceUpdateSchema)(req, res, next);
};

export const validateSystemSetting = (req, res, next) => {
  const systemSettingSchema = z.object({
    value: z.string().min(1),
  });

  validateSchema(systemSettingSchema)(req, res, next);
};

export const validateUser = (req, res, next) => {
  const userSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'TENANT']),
    companyName: z.string().optional(),
    phone: z.string().optional(),
  });

  validateSchema(userSchema)(req, res, next);
};

export const validateUserUpdate = (req, res, next) => {
  const userUpdateSchema = z.object({
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    role: z.enum(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'TENANT']).optional(),
    companyName: z.string().optional(),
    phone: z.string().optional(),
  });

  validateSchema(userUpdateSchema)(req, res, next);
};