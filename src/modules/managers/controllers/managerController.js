import { asyncHandler } from '../../../middleware/errorHandler.js';
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { hashPassword, generateRandomPassword } from '../../../utils/helpers.js';
import { sendWelcomeEmail } from '../../notifications/services/emailService.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Manager:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         phone:
 *           type: string
 *         permissions:
 *           type: object
 *         isActive:
 *           type: boolean
 */

/**
 * @swagger
 * /managers:
 *   get:
 *     tags: [Managers]
 *     summary: Get all managers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Managers retrieved successfully
 */
export const getManagers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  // Role-based filtering
  if (req.user.role === 'OWNER') {
    where.ownerId = req.user.owner.id;
  }

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [managers, total] = await Promise.all([
    prisma.manager.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            lastLogin: true,
          },
        },
        owner: {
          select: {
            id: true,
            companyName: true,
          },
        },
        properties: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.manager.count({ where }),
  ]);

  res.json({
    managers,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * @swagger
 * /managers/{id}:
 *   get:
 *     tags: [Managers]
 *     summary: Get manager by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Manager retrieved successfully
 */
export const getManagerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const manager = await prisma.manager.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
      },
      owner: {
        select: {
          id: true,
          companyName: true,
          phone: true,
        },
      },
      properties: {
        include: {
          tenants: {
            where: { isActive: true },
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              tenants: { where: { isActive: true } },
            },
          },
        },
      },
    },
  });

  if (!manager) {
    return res.status(404).json({
      error: 'Manager not found',
      message: 'Manager with this ID does not exist',
    });
  }

  // Check permissions
  if (req.user.role === 'OWNER' && manager.ownerId !== req.user.owner.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own managers',
    });
  }

  if (req.user.role === 'MANAGER' && manager.id !== req.user.manager.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own information',
    });
  }

  res.json({ manager });
});

/**
 * @swagger
 * /managers:
 *   post:
 *     tags: [Managers]
 *     summary: Create a new manager
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               permissions:
 *                 type: object
 *     responses:
 *       201:
 *         description: Manager created successfully
 */
export const createManager = asyncHandler(async (req, res) => {
  const { email, firstName, lastName, phone, permissions = {} } = req.body;

  // Check if email is already in use
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    return res.status(409).json({
      error: 'Email already exists',
      message: 'A user with this email already exists',
    });
  }

  // Generate random password
  const password = generateRandomPassword();
  const hashedPassword = await hashPassword(password);

  const ownerId = req.user.owner.id;

  // Create user and manager in transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'MANAGER',
      },
    });

    const manager = await tx.manager.create({
      data: {
        userId: user.id,
        ownerId,
        firstName,
        lastName,
        phone,
        permissions,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
        owner: {
          select: {
            companyName: true,
          },
        },
      },
    });

    return { user, manager };
  });

  // Send welcome email with password
  try {
    await sendWelcomeEmail(email, 'MANAGER', password);
  } catch (error) {
    logger.error('Failed to send manager welcome email:', error);
  }

  logger.info(`Manager created: ${firstName} ${lastName} by user ${req.user.email}`);

  res.status(201).json({
    message: 'Manager created successfully',
    manager: result.manager,
  });
});

/**
 * @swagger
 * /managers/{id}:
 *   put:
 *     tags: [Managers]
 *     summary: Update manager
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Manager updated successfully
 */
export const updateManager = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, phone, permissions } = req.body;

  const existingManager = await prisma.manager.findUnique({
    where: { id },
  });

  if (!existingManager) {
    return res.status(404).json({
      error: 'Manager not found',
      message: 'Manager with this ID does not exist',
    });
  }

  // Check permissions
  if (req.user.role === 'OWNER' && existingManager.ownerId !== req.user.owner.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only update your own managers',
    });
  }

  if (req.user.role === 'MANAGER' && existingManager.id !== req.user.manager.id) {
    // Managers can only update their own basic info, not permissions
    if (permissions) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You cannot update your own permissions',
      });
    }
  }

  const updateData = {};
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (phone) updateData.phone = phone;
  if (permissions && req.user.role === 'OWNER') updateData.permissions = permissions;

  const manager = await prisma.manager.update({
    where: { id },
    data: updateData,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      },
      owner: {
        select: {
          companyName: true,
        },
      },
    },
  });

  logger.info(`Manager updated: ${manager.firstName} ${manager.lastName} by user ${req.user.email}`);

  res.json({
    message: 'Manager updated successfully',
    manager,
  });
});

/**
 * @swagger
 * /managers/{id}:
 *   delete:
 *     tags: [Managers]
 *     summary: Delete manager
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Manager deleted successfully
 */
export const deleteManager = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existingManager = await prisma.manager.findUnique({
    where: { id },
    include: {
      properties: true,
    },
  });

  if (!existingManager) {
    return res.status(404).json({
      error: 'Manager not found',
      message: 'Manager with this ID does not exist',
    });
  }

  // Check permissions
  if (existingManager.ownerId !== req.user.owner.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only delete your own managers',
    });
  }

  // Remove manager from properties and deactivate user
  await prisma.$transaction([
    prisma.manager.delete({
      where: { id },
    }),
    prisma.user.update({
      where: { id: existingManager.userId },
      data: { isActive: false },
    }),
  ]);

  logger.info(`Manager deleted: ${existingManager.firstName} ${existingManager.lastName} by user ${req.user.email}`);

  res.json({
    message: 'Manager deleted successfully',
  });
});

export const assignPropertyToManager = asyncHandler(async (req, res) => {
  const { id: managerId, propertyId } = req.params;

  // Verify manager exists and belongs to owner
  const manager = await prisma.manager.findUnique({
    where: { id: managerId },
  });

  if (!manager || manager.ownerId !== req.user.owner.id) {
    return res.status(404).json({
      error: 'Manager not found',
      message: 'Manager not found or does not belong to you',
    });
  }

  // Verify property exists and belongs to owner
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property || property.ownerId !== req.user.owner.id) {
    return res.status(404).json({
      error: 'Property not found',
      message: 'Property not found or does not belong to you',
    });
  }

  // Add property to manager's properties
  await prisma.manager.update({
    where: { id: managerId },
    data: {
      properties: {
        connect: { id: propertyId },
      },
    },
  });

  logger.info(`Property ${propertyId} assigned to manager ${managerId} by ${req.user.email}`);

  res.json({
    message: 'Property assigned to manager successfully',
  });
});

export const removePropertyFromManager = asyncHandler(async (req, res) => {
  const { id: managerId, propertyId } = req.params;

  // Verify manager exists and belongs to owner
  const manager = await prisma.manager.findUnique({
    where: { id: managerId },
  });

  if (!manager || manager.ownerId !== req.user.owner.id) {
    return res.status(404).json({
      error: 'Manager not found',
      message: 'Manager not found or does not belong to you',
    });
  }

  // Remove property from manager's properties
  await prisma.manager.update({
    where: { id: managerId },
    data: {
      properties: {
        disconnect: { id: propertyId },
      },
    },
  });

  logger.info(`Property ${propertyId} removed from manager ${managerId} by ${req.user.email}`);

  res.json({
    message: 'Property removed from manager successfully',
  });
});

export const getManagerProperties = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const manager = await prisma.manager.findUnique({
    where: { id },
    include: {
      properties: {
        include: {
          tenants: {
            where: { isActive: true },
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              tenants: { where: { isActive: true } },
              leases: { where: { status: 'ACTIVE' } },
            },
          },
        },
      },
    },
  });

  if (!manager) {
    return res.status(404).json({
      error: 'Manager not found',
      message: 'Manager with this ID does not exist',
    });
  }

  // Check permissions
  if (req.user.role === 'OWNER' && manager.ownerId !== req.user.owner.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own managers',
    });
  }

  if (req.user.role === 'MANAGER' && manager.id !== req.user.manager.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own properties',
    });
  }

  res.json({
    properties: manager.properties,
  });
});