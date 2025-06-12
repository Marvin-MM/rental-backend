
import express from 'express';
import { body } from 'express-validator';
import { 
  register, 
  login, 
  getMe, 
  changePassword, 
  getUserRoles 
} from '../controllers/authController.js';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { handleValidationErrors } from '../../../middleware/validation.js';
import { authLimiter, bruteForce } from '../../../middleware/rateLimiter.js';

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('role')
    .isIn(['SUPER_ADMIN', 'OWNER', 'MANAGER', 'TENANT'])
    .withMessage('Invalid role'),
  body('companyName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
];

// Public routes
router.post('/register', authLimiter, registerValidation, handleValidationErrors, register);
router.post('/login', authLimiter, bruteForce.prevent, loginValidation, handleValidationErrors, login);

// Protected routes
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePasswordValidation, handleValidationErrors, changePassword);
router.get('/roles/:userId', authenticate, authorize('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TENANT'), getUserRoles);

export default router;
