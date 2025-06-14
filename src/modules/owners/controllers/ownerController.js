
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { hashPassword } from '../../../utils/helpers.js';

export const createOwner = async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName, phone, address } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists',
        message: 'A user with this email already exists',
      });
    }

    const hashedPassword = await hashPassword(password);

    const owner = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: 'OWNER',
        firstName,
        lastName,
        owner: {
          create: {
            companyName,
            phone,
            address,
          },
        },
      },
      include: {
        owner: true,
      },
    });

    // Remove password from response
    const { password: _, ...ownerResponse } = owner;

    logger.info(`Owner created: ${companyName} by ${req.user.email}`);

    res.status(201).json({
      message: 'Owner created successfully',
      owner: ownerResponse,
    });
  } catch (error) {
    logger.error('Error creating owner:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create owner',
    });
  }
};

export const getOwners = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { owner: { companyName: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const [owners, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: 'OWNER',
          ...where,
        },
        skip,
        take: parseInt(limit),
        include: {
          owner: {
            include: {
              _count: {
                select: {
                  properties: true,
                  managers: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({
        where: {
          role: 'OWNER',
          ...where,
        },
      }),
    ]);

    // Remove passwords from response
    const ownersResponse = owners.map(owner => {
      const { password, ...ownerData } = owner;
      return ownerData;
    });

    res.json({
      owners: ownersResponse,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching owners:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch owners',
    });
  }
};

export const getOwnerById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check permissions
    if (req.user.role === 'OWNER' && req.user.owner.id !== id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own information',
      });
    }

    const owner = await prisma.user.findFirst({
      where: {
        role: 'OWNER',
        owner: { id },
      },
      include: {
        owner: {
          include: {
            properties: {
              select: {
                id: true,
                name: true,
                address: true,
                type: true,
                status: true,
              },
            },
            managers: {
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
          },
        },
      },
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Owner not found',
        message: 'Owner with this ID does not exist',
      });
    }

    // Remove password from response
    const { password, ...ownerResponse } = owner;

    res.json(ownerResponse);
  } catch (error) {
    logger.error('Error fetching owner:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch owner',
    });
  }
};

export const updateOwner = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, phone, address } = req.body;

    // Check permissions
    if (req.user.role === 'OWNER' && req.user.owner.id !== id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own information',
      });
    }

    const existingOwner = await prisma.owner.findUnique({
      where: { id },
    });

    if (!existingOwner) {
      return res.status(404).json({
        error: 'Owner not found',
        message: 'Owner with this ID does not exist',
      });
    }

    const updatedOwner = await prisma.owner.update({
      where: { id },
      data: {
        companyName,
        phone,
        address,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    logger.info(`Owner updated: ${updatedOwner.companyName} by ${req.user.email}`);

    res.json({
      message: 'Owner updated successfully',
      owner: updatedOwner,
    });
  } catch (error) {
    logger.error('Error updating owner:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update owner',
    });
  }
};

export const deleteOwner = async (req, res) => {
  try {
    const { id } = req.params;

    const owner = await prisma.owner.findUnique({
      where: { id },
      include: {
        properties: true,
        managers: true,
      },
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Owner not found',
        message: 'Owner with this ID does not exist',
      });
    }

    // Check if owner has properties or managers
    if (owner.properties.length > 0 || owner.managers.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete owner',
        message: 'Owner has associated properties or managers. Please transfer or delete them first.',
      });
    }

    await prisma.user.delete({
      where: { id: owner.userId },
    });

    logger.info(`Owner deleted: ${owner.companyName} by ${req.user.email}`);

    res.json({
      message: 'Owner deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting owner:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete owner',
    });
  }
};

export const getOwnerProperties = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Check permissions
    if (req.user.role === 'OWNER' && req.user.owner.id !== id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own properties',
      });
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where: { ownerId: id },
        skip,
        take: parseInt(limit),
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.property.count({
        where: { ownerId: id },
      }),
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
  } catch (error) {
    logger.error('Error fetching owner properties:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch owner properties',
    });
  }
};

export const getOwnerAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    // Check permissions
    if (req.user.role === 'OWNER' && req.user.owner.id !== id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own analytics',
      });
    }

    const analytics = await prisma.owner.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            properties: true,
            managers: true,
          },
        },
        properties: {
          include: {
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

    if (!analytics) {
      return res.status(404).json({
        error: 'Owner not found',
        message: 'Owner with this ID does not exist',
      });
    }

    // Calculate analytics
    const totalTenants = analytics.properties.reduce((sum, property) => sum + property._count.tenants, 0);
    const totalLeases = analytics.properties.reduce((sum, property) => sum + property._count.leases, 0);
    const occupancyRate = analytics.properties.length > 0 
      ? ((totalLeases / analytics.properties.length) * 100).toFixed(2)
      : 0;

    res.json({
      totalProperties: analytics._count.properties,
      totalManagers: analytics._count.managers,
      totalTenants,
      totalActiveLeases: totalLeases,
      occupancyRate: parseFloat(occupancyRate),
    });
  } catch (error) {
    logger.error('Error fetching owner analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch owner analytics',
    });
  }
};
