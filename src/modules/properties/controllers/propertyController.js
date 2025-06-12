
import { asyncHandler } from '../../../middleware/errorHandler.js';
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../../../utils/cloudinary.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Property:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         address:
 *           type: string
 *         type:
 *           type: string
 *           enum: [APARTMENT, HOUSE, CONDO, TOWNHOUSE, STUDIO, OTHER]
 *         units:
 *           type: integer
 *         rentAmount:
 *           type: number
 *         status:
 *           type: string
 *           enum: [AVAILABLE, OCCUPIED, MAINTENANCE, UNAVAILABLE]
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 */

/**
 * @swagger
 * /properties:
 *   get:
 *     tags: [Properties]
 *     summary: Get all properties
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AVAILABLE, OCCUPIED, MAINTENANCE, UNAVAILABLE]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [APARTMENT, HOUSE, CONDO, TOWNHOUSE, STUDIO, OTHER]
 *     responses:
 *       200:
 *         description: Properties retrieved successfully
 */
export const getProperties = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, type, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  // Role-based filtering
  if (req.user.role === 'OWNER') {
    where.ownerId = req.user.owner.id;
  } else if (req.user.role === 'MANAGER') {
    where.ownerId = req.user.manager.ownerId;
  }

  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        owner: {
          select: {
            id: true,
            companyName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        tenants: {
          where: { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: {
              select: {
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            tenants: { where: { isActive: true } },
            leases: { where: { status: 'ACTIVE' } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.property.count({ where }),
  ]);

  res.json({
    properties,
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
 * /properties/{id}:
 *   get:
 *     tags: [Properties]
 *     summary: Get property by ID
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
 *         description: Property retrieved successfully
 *       404:
 *         description: Property not found
 */
export const getPropertyById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          companyName: true,
          phone: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
      tenants: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              email: true,
            },
          },
          leases: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              startDate: true,
              endDate: true,
              rentAmount: true,
            },
          },
        },
      },
      leases: {
        include: {
          tenant: {
            select: {
              firstName: true,
              lastName: true,
              user: {
                select: {
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      complaints: {
        where: { status: { not: 'CLOSED' } },
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

  if (!property) {
    return res.status(404).json({
      error: 'Property not found',
      message: 'Property with this ID does not exist',
    });
  }

  // Check access permissions
  if (req.user.role === 'OWNER' && property.ownerId !== req.user.owner.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own properties',
    });
  }

  if (req.user.role === 'MANAGER' && property.ownerId !== req.user.manager.ownerId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access properties you manage',
    });
  }

  res.json({ property });
});

/**
 * @swagger
 * /properties:
 *   post:
 *     tags: [Properties]
 *     summary: Create a new property
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *               - rentAmount
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               address:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [APARTMENT, HOUSE, CONDO, TOWNHOUSE, STUDIO, OTHER]
 *               units:
 *                 type: integer
 *               rentAmount:
 *                 type: number
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Property created successfully
 */
export const createProperty = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    address,
    type = 'APARTMENT',
    units = 1,
    rentAmount,
    amenities = [],
  } = req.body;

  const ownerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;

  const property = await prisma.property.create({
    data: {
      name,
      description,
      address,
      type,
      units: parseInt(units),
      rentAmount: parseFloat(rentAmount),
      amenities,
      ownerId,
    },
    include: {
      owner: {
        select: {
          companyName: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  logger.info(`Property created: ${property.name} by user ${req.user.email}`);

  res.status(201).json({
    message: 'Property created successfully',
    property,
  });
});

/**
 * @swagger
 * /properties/{id}:
 *   put:
 *     tags: [Properties]
 *     summary: Update property
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               address:
 *                 type: string
 *               type:
 *                 type: string
 *               units:
 *                 type: integer
 *               rentAmount:
 *                 type: number
 *               status:
 *                 type: string
 *               amenities:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Property updated successfully
 */
export const updateProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check if property exists and user has permission
  const existingProperty = await prisma.property.findUnique({
    where: { id },
  });

  if (!existingProperty) {
    return res.status(404).json({
      error: 'Property not found',
      message: 'Property with this ID does not exist',
    });
  }

  // Check permissions
  const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;
  if (existingProperty.ownerId !== allowedOwnerId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only update your own properties',
    });
  }

  // Convert numeric fields
  if (updateData.units) updateData.units = parseInt(updateData.units);
  if (updateData.rentAmount) updateData.rentAmount = parseFloat(updateData.rentAmount);

  const property = await prisma.property.update({
    where: { id },
    data: updateData,
    include: {
      owner: {
        select: {
          companyName: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  logger.info(`Property updated: ${property.name} by user ${req.user.email}`);

  res.json({
    message: 'Property updated successfully',
    property,
  });
});

/**
 * @swagger
 * /properties/{id}/images:
 *   post:
 *     tags: [Properties]
 *     summary: Upload property images
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Images uploaded successfully
 */
export const uploadPropertyImages = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      error: 'No images provided',
      message: 'Please select at least one image to upload',
    });
  }

  // Check if property exists and user has permission
  const property = await prisma.property.findUnique({
    where: { id },
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
      message: 'You can only upload images for your own properties',
    });
  }

  // Upload images to Cloudinary
  const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer, 'properties'));
  const uploadResults = await Promise.all(uploadPromises);
  const imageUrls = uploadResults.map(result => result.secure_url);

  // Update property with new images
  const updatedProperty = await prisma.property.update({
    where: { id },
    data: {
      images: [...property.images, ...imageUrls],
    },
  });

  logger.info(`Images uploaded for property: ${property.name} by user ${req.user.email}`);

  res.json({
    message: 'Images uploaded successfully',
    images: imageUrls,
    property: updatedProperty,
  });
});

/**
 * @swagger
 * /properties/{id}:
 *   delete:
 *     tags: [Properties]
 *     summary: Delete property
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
 *         description: Property deleted successfully
 */
export const deleteProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      tenants: { where: { isActive: true } },
      leases: { where: { status: 'ACTIVE' } },
    },
  });

  if (!property) {
    return res.status(404).json({
      error: 'Property not found',
      message: 'Property with this ID does not exist',
    });
  }

  // Check permissions
  const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;
  if (property.ownerId !== allowedOwnerId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only delete your own properties',
    });
  }

  // Check if property has active tenants or leases
  if (property.tenants.length > 0 || property.leases.length > 0) {
    return res.status(400).json({
      error: 'Cannot delete property',
      message: 'Property has active tenants or leases. Please resolve them first.',
    });
  }

  // Delete images from Cloudinary
  if (property.images.length > 0) {
    const deletePromises = property.images.map(imageUrl => {
      const publicId = imageUrl.split('/').pop().split('.')[0];
      return deleteFromCloudinary(publicId);
    });
    await Promise.allSettled(deletePromises);
  }

  await prisma.property.delete({
    where: { id },
  });

  logger.info(`Property deleted: ${property.name} by user ${req.user.email}`);

  res.json({
    message: 'Property deleted successfully',
  });
});
