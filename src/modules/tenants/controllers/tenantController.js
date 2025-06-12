
import { asyncHandler } from '../../../middleware/errorHandler.js';
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { createTenantUser } from '../../auth/controllers/authController.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Tenant:
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
 *         emergencyContact:
 *           type: object
 *         moveInDate:
 *           type: string
 *           format: date
 *         isActive:
 *           type: boolean
 */

/**
 * @swagger
 * /tenants:
 *   get:
 *     tags: [Tenants]
 *     summary: Get all tenants
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: propertyId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Tenants retrieved successfully
 */
export const getTenants = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, propertyId, isActive, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  // Role-based filtering
  if (req.user.role === 'OWNER') {
    where.property = { ownerId: req.user.owner.id };
  } else if (req.user.role === 'MANAGER') {
    where.property = { ownerId: req.user.manager.ownerId };
  }

  if (propertyId) where.propertyId = propertyId;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
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
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            type: true,
          },
        },
        leases: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            startDate: true,
            endDate: true,
            rentAmount: true,
            status: true,
          },
        },
        payments: {
          where: { status: 'OVERDUE' },
          select: {
            id: true,
            amount: true,
            dueDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tenant.count({ where }),
  ]);

  res.json({
    tenants,
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
 * /tenants/{id}:
 *   get:
 *     tags: [Tenants]
 *     summary: Get tenant by ID
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
 *         description: Tenant retrieved successfully
 *       404:
 *         description: Tenant not found
 */
export const getTenantById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const tenant = await prisma.tenant.findUnique({
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
      property: {
        include: {
          owner: {
            select: {
              companyName: true,
              phone: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      },
      leases: {
        include: {
          payments: {
            select: {
              id: true,
              amount: true,
              dueDate: true,
              paidDate: true,
              status: true,
            },
            orderBy: { dueDate: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          dueDate: true,
          paidDate: true,
          status: true,
          method: true,
        },
        orderBy: { dueDate: 'desc' },
        take: 10,
      },
      complaints: {
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!tenant) {
    return res.status(404).json({
      error: 'Tenant not found',
      message: 'Tenant with this ID does not exist',
    });
  }

  // Check access permissions
  if (req.user.role === 'TENANT' && tenant.userId !== req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own information',
    });
  }

  if (req.user.role === 'OWNER' && tenant.property.ownerId !== req.user.owner.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your property tenants',
    });
  }

  if (req.user.role === 'MANAGER' && tenant.property.ownerId !== req.user.manager.ownerId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access tenants you manage',
    });
  }

  res.json({ tenant });
});

/**
 * @swagger
 * /tenants:
 *   post:
 *     tags: [Tenants]
 *     summary: Add a new tenant
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
 *               - phone
 *               - propertyId
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
 *               propertyId:
 *                 type: string
 *               emergencyContact:
 *                 type: object
 *               moveInDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Tenant added successfully
 */
export const addTenant = asyncHandler(async (req, res) => {
  const {
    email,
    firstName,
    lastName,
    phone,
    propertyId,
    emergencyContact,
    moveInDate,
  } = req.body;

  // Check if property exists and user has permission
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    return res.status(404).json({
      error: 'Property not found',
      message: 'Property with this ID does not exist',
    });
  }

  const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;
  if (property.ownerId !== allowedOwnerId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only add tenants to your own properties',
    });
  }

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

  // Create user account for tenant
  const user = await createTenantUser(email, { firstName, lastName });

  // Create tenant record
  const tenant = await prisma.tenant.create({
    data: {
      userId: user.id,
      propertyId,
      firstName,
      lastName,
      phone,
      emergencyContact,
      moveInDate: moveInDate ? new Date(moveInDate) : null,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      },
      property: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    },
  });

  logger.info(`Tenant added: ${firstName} ${lastName} by user ${req.user.email}`);

  res.status(201).json({
    message: 'Tenant added successfully',
    tenant,
  });
});

/**
 * @swagger
 * /tenants/{id}:
 *   put:
 *     tags: [Tenants]
 *     summary: Update tenant information
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               emergencyContact:
 *                 type: object
 *               moveInDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Tenant updated successfully
 */
export const updateTenant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const existingTenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      property: true,
    },
  });

  if (!existingTenant) {
    return res.status(404).json({
      error: 'Tenant not found',
      message: 'Tenant with this ID does not exist',
    });
  }

  // Check permissions
  if (req.user.role === 'TENANT' && existingTenant.userId !== req.user.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only update your own information',
    });
  }

  if (req.user.role === 'OWNER' && existingTenant.property.ownerId !== req.user.owner.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only update your property tenants',
    });
  }

  if (req.user.role === 'MANAGER' && existingTenant.property.ownerId !== req.user.manager.ownerId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only update tenants you manage',
    });
  }

  // Convert date
  if (updateData.moveInDate) {
    updateData.moveInDate = new Date(updateData.moveInDate);
  }

  const tenant = await prisma.tenant.update({
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
      property: {
        select: {
          id: true,
          name: true,
          address: true,
        },
      },
    },
  });

  logger.info(`Tenant updated: ${tenant.firstName} ${tenant.lastName} by user ${req.user.email}`);

  res.json({
    message: 'Tenant updated successfully',
    tenant,
  });
});

/**
 * @swagger
 * /tenants/{id}/deactivate:
 *   patch:
 *     tags: [Tenants]
 *     summary: Deactivate tenant
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
 *         description: Tenant deactivated successfully
 */
export const deactivateTenant = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existingTenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      property: true,
      leases: { where: { status: 'ACTIVE' } },
    },
  });

  if (!existingTenant) {
    return res.status(404).json({
      error: 'Tenant not found',
      message: 'Tenant with this ID does not exist',
    });
  }

  // Check permissions
  const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;
  if (existingTenant.property.ownerId !== allowedOwnerId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only deactivate your property tenants',
    });
  }

  // Check for active leases
  if (existingTenant.leases.length > 0) {
    return res.status(400).json({
      error: 'Cannot deactivate tenant',
      message: 'Tenant has active leases. Please terminate leases first.',
    });
  }

  // Deactivate tenant and user
  await prisma.$transaction([
    prisma.tenant.update({
      where: { id },
      data: { isActive: false },
    }),
    prisma.user.update({
      where: { id: existingTenant.userId },
      data: { isActive: false },
    }),
  ]);

  logger.info(`Tenant deactivated: ${existingTenant.firstName} ${existingTenant.lastName} by user ${req.user.email}`);

  res.json({
    message: 'Tenant deactivated successfully',
  });
});

/**
 * @swagger
 * /tenants/me:
 *   get:
 *     tags: [Tenants]
 *     summary: Get current tenant profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant profile retrieved successfully
 */
export const getTenantProfile = asyncHandler(async (req, res) => {
  if (req.user.role !== 'TENANT') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This endpoint is only for tenants',
    });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { userId: req.user.id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
          lastLogin: true,
        },
      },
      property: {
        include: {
          owner: {
            select: {
              companyName: true,
              phone: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
      },
      leases: {
        where: { status: 'ACTIVE' },
        include: {
          payments: {
            select: {
              id: true,
              amount: true,
              dueDate: true,
              paidDate: true,
              status: true,
            },
            orderBy: { dueDate: 'desc' },
            take: 5,
          },
        },
      },
      payments: {
        where: { status: { in: ['PENDING', 'OVERDUE'] } },
        select: {
          id: true,
          amount: true,
          dueDate: true,
          status: true,
        },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  if (!tenant) {
    return res.status(404).json({
      error: 'Tenant profile not found',
      message: 'Your tenant profile could not be found',
    });
  }

  res.json({ tenant });
});
