
import bcrypt from 'bcryptjs';
import { hashPassword, comparePassword, generateToken, generateRandomPassword } from '../../../utils/helpers.js';
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { sendWelcomeEmail } from '../../notifications/services/emailService.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         email:
 *           type: string
 *         role:
 *           type: string
 *           enum: [SUPER_ADMIN, OWNER, MANAGER, TENANT]
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               role:
 *                 type: string
 *                 enum: [SUPER_ADMIN, OWNER, MANAGER, TENANT]
 *               companyName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: User already exists
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, role, companyName, firstName, lastName, phone } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    return res.status(409).json({
      error: 'User already exists',
      message: 'A user with this email already exists',
    });
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      firstName,
      lastName,
    },
  });

  // Create role-specific profile
  if (role === 'OWNER') {
    await prisma.owner.create({
      data: {
        userId: user.id,
        companyName,
        phone,
      },
    });
  }

  // Log registration attempt
  await prisma.loginAttempt.create({
    data: {
      userId: user.id,
      email: user.email,
      ipAddress: req.ip,
      success: true,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info(`User registered: ${user.email} with role: ${role}`);

  // Send welcome email
  try {
    await sendWelcomeEmail(user.email, user.role);
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
  }

  // Generate token
  const token = generateToken({ userId: user.id, role: user.role });

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  });
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
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
    // Log failed attempt
    await prisma.loginAttempt.create({
      data: {
        email: email.toLowerCase(),
        ipAddress: req.ip,
        success: false,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(401).json({
      error: 'Invalid credentials',
      message: 'Invalid email or password',
    });
  }

  // Verify password
  const isValidPassword = await comparePassword(password, user.password);

  if (!isValidPassword) {
    // Log failed attempt
    await prisma.loginAttempt.create({
      data: {
        userId: user.id,
        email: user.email,
        ipAddress: req.ip,
        success: false,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(401).json({
      error: 'Invalid credentials',
      message: 'Invalid email or password',
    });
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Log successful attempt
  await prisma.loginAttempt.create({
    data: {
      userId: user.id,
      email: user.email,
      ipAddress: req.ip,
      success: true,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info(`User logged in: ${user.email}`);

  // Generate token
  const token = generateToken({ userId: user.id, role: user.role });

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      profile: user.tenant || user.owner || user.manager,
    },
  });
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      tenant: {
        include: {
          property: true,
        },
      },
      owner: true,
      manager: {
        include: {
          owner: true,
        },
      },
    },
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      profile: user.tenant || user.owner || user.manager,
    },
  });
});

/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     tags: [Authentication]
 *     summary: Change user password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Invalid current password
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Get current user
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  // Verify current password
  const isValidPassword = await comparePassword(currentPassword, user.password);

  if (!isValidPassword) {
    return res.status(401).json({
      error: 'Invalid password',
      message: 'Current password is incorrect',
    });
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  logger.info(`Password changed for user: ${user.email}`);

  res.json({
    message: 'Password changed successfully',
  });
});

/**
 * Create tenant user account (internal service method)
 */
export const createTenantUser = async (email, tenantData) => {
  try {
    // Generate random password
    const password = generateRandomPassword();
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'TENANT',
      },
    });

    logger.info(`Tenant user created: ${user.email}`);

    // Send welcome email with password
    try {
      await sendWelcomeEmail(user.email, 'TENANT', password);
    } catch (error) {
      logger.error('Failed to send tenant welcome email:', error);
    }

    return user;
  } catch (error) {
    logger.error('Error creating tenant user:', error);
    throw error;
  }
};

/**
 * @swagger
 * /auth/roles/{userId}:
 *   get:
 *     tags: [Authentication]
 *     summary: Get user roles and permissions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User roles and permissions retrieved
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
export const getUserRoles = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Check if user can access this information
  if (req.user.id !== userId && !['SUPER_ADMIN', 'OWNER'].includes(req.user.role)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own role information',
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      manager: {
        include: {
          owner: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: 'User with this ID does not exist',
    });
  }

  const roleData = {
    role: user.role,
    permissions: {},
  };

  if (user.role === 'MANAGER' && user.manager) {
    roleData.permissions = user.manager.permissions || {};
    roleData.ownerId = user.manager.ownerId;
  }

  res.json({
    userId: user.id,
    email: user.email,
    ...roleData,
  });
});
