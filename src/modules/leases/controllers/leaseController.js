
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { sendNotificationToUser } from '../../notifications/services/socketService.js';

export const createLease = async (req, res) => {
  try {
    const {
      tenantId,
      propertyId,
      startDate,
      endDate,
      monthlyRent,
      securityDeposit,
      terms,
      utilities,
    } = req.body;

    // Verify tenant and property exist and check permissions
    const [tenant, property] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { user: true },
      }),
      prisma.property.findUnique({
        where: { id: propertyId },
        include: { owner: true },
      }),
    ]);

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: 'Tenant with this ID does not exist',
      });
    }

    if (!property) {
      return res.status(404).json({
        error: 'Property not found',
        message: 'Property with this ID does not exist',
      });
    }

    // Check permissions
    const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager?.ownerId;
    if (property.ownerId !== allowedOwnerId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only create leases for your own properties',
      });
    }

    // Check for overlapping active leases
    const existingLease = await prisma.lease.findFirst({
      where: {
        OR: [
          { tenantId, status: 'ACTIVE' },
          {
            propertyId,
            status: 'ACTIVE',
            OR: [
              {
                startDate: { lte: new Date(endDate) },
                endDate: { gte: new Date(startDate) },
              },
            ],
          },
        ],
      },
    });

    if (existingLease) {
      return res.status(400).json({
        error: 'Conflicting lease',
        message: 'Tenant already has an active lease or property has overlapping lease period',
      });
    }

    const lease = await prisma.lease.create({
      data: {
        tenantId,
        propertyId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        monthlyRent: parseFloat(monthlyRent),
        securityDeposit: parseFloat(securityDeposit),
        terms,
        utilities,
        status: 'ACTIVE',
      },
      include: {
        tenant: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
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

    // Update tenant status
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: true },
    });

    // Send notification to tenant
    await sendNotificationToUser(tenant.user.id, {
      title: 'New Lease Agreement',
      body: `Your lease for ${property.name} has been created and is now active.`,
      type: 'lease',
      data: { leaseId: lease.id },
    });

    logger.info(`Lease created for tenant ${tenant.user.email} at property ${property.name} by ${req.user.email}`);

    res.status(201).json({
      message: 'Lease created successfully',
      lease,
    });
  } catch (error) {
    logger.error('Error creating lease:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create lease',
    });
  }
};

export const getLeases = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, propertyId, tenantId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};

    // Apply role-based filtering
    if (req.user.role === 'OWNER') {
      where.property = { ownerId: req.user.owner.id };
    } else if (req.user.role === 'MANAGER') {
      where.property = { ownerId: req.user.manager.ownerId };
    } else if (req.user.role === 'TENANT') {
      where.tenantId = req.user.tenant.id;
    }

    // Apply filters
    if (status) where.status = status;
    if (propertyId) where.propertyId = propertyId;
    if (tenantId) where.tenantId = tenantId;

    const [leases, total] = await Promise.all([
      prisma.lease.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          tenant: {
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
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              status: true,
              dueDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lease.count({ where }),
    ]);

    res.json({
      leases,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching leases:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch leases',
    });
  }
};

export const getLeaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const lease = await prisma.lease.findUnique({
      where: { id },
      include: {
        tenant: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
        property: {
          include: {
            owner: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
        payments: {
          orderBy: { dueDate: 'desc' },
        },
        documents: true,
      },
    });

    if (!lease) {
      return res.status(404).json({
        error: 'Lease not found',
        message: 'Lease with this ID does not exist',
      });
    }

    // Check permissions
    if (req.user.role === 'OWNER' && lease.property.ownerId !== req.user.owner.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access leases for your own properties',
      });
    }

    if (req.user.role === 'MANAGER' && lease.property.ownerId !== req.user.manager.ownerId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access leases for properties you manage',
      });
    }

    if (req.user.role === 'TENANT' && lease.tenantId !== req.user.tenant.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own leases',
      });
    }

    res.json(lease);
  } catch (error) {
    logger.error('Error fetching lease:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch lease',
    });
  }
};

export const updateLease = async (req, res) => {
  try {
    const { id } = req.params;
    const { monthlyRent, terms, utilities } = req.body;

    const existingLease = await prisma.lease.findUnique({
      where: { id },
      include: {
        property: true,
        tenant: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!existingLease) {
      return res.status(404).json({
        error: 'Lease not found',
        message: 'Lease with this ID does not exist',
      });
    }

    // Check permissions
    const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager?.ownerId;
    if (existingLease.property.ownerId !== allowedOwnerId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update leases for your own properties',
      });
    }

    const updatedLease = await prisma.lease.update({
      where: { id },
      data: {
        ...(monthlyRent && { monthlyRent: parseFloat(monthlyRent) }),
        ...(terms && { terms }),
        ...(utilities && { utilities }),
      },
      include: {
        tenant: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
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

    // Send notification to tenant if rent was changed
    if (monthlyRent && parseFloat(monthlyRent) !== existingLease.monthlyRent) {
      await sendNotificationToUser(existingLease.tenant.user.id, {
        title: 'Lease Updated',
        body: `Your lease terms have been updated. New monthly rent: $${monthlyRent}`,
        type: 'lease',
        data: { leaseId: id },
      });
    }

    logger.info(`Lease updated: ${id} by ${req.user.email}`);

    res.json({
      message: 'Lease updated successfully',
      lease: updatedLease,
    });
  } catch (error) {
    logger.error('Error updating lease:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update lease',
    });
  }
};

export const deleteLease = async (req, res) => {
  try {
    const { id } = req.params;

    const lease = await prisma.lease.findUnique({
      where: { id },
      include: {
        property: true,
        payments: true,
      },
    });

    if (!lease) {
      return res.status(404).json({
        error: 'Lease not found',
        message: 'Lease with this ID does not exist',
      });
    }

    // Check permissions
    const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager?.ownerId;
    if (lease.property.ownerId !== allowedOwnerId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete leases for your own properties',
      });
    }

    // Check if lease has payments
    if (lease.payments.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete lease',
        message: 'Lease has associated payments. Please handle them first.',
      });
    }

    await prisma.lease.delete({
      where: { id },
    });

    logger.info(`Lease deleted: ${id} by ${req.user.email}`);

    res.json({
      message: 'Lease deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting lease:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete lease',
    });
  }
};

export const terminateLease = async (req, res) => {
  try {
    const { id } = req.params;
    const { terminationDate, reason } = req.body;

    const lease = await prisma.lease.findUnique({
      where: { id },
      include: {
        property: true,
        tenant: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!lease) {
      return res.status(404).json({
        error: 'Lease not found',
        message: 'Lease with this ID does not exist',
      });
    }

    // Check permissions
    const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager?.ownerId;
    if (lease.property.ownerId !== allowedOwnerId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only terminate leases for your own properties',
      });
    }

    if (lease.status === 'TERMINATED') {
      return res.status(400).json({
        error: 'Lease already terminated',
        message: 'This lease has already been terminated',
      });
    }

    const updatedLease = await prisma.lease.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        terminationDate: terminationDate ? new Date(terminationDate) : new Date(),
        terminationReason: reason,
      },
    });

    // Update tenant status
    await prisma.tenant.update({
      where: { id: lease.tenantId },
      data: { isActive: false },
    });

    // Send notification to tenant
    await sendNotificationToUser(lease.tenant.user.id, {
      title: 'Lease Terminated',
      body: `Your lease for ${lease.property.name} has been terminated.`,
      type: 'lease',
      data: { leaseId: id },
    });

    logger.info(`Lease terminated: ${id} by ${req.user.email}`);

    res.json({
      message: 'Lease terminated successfully',
      lease: updatedLease,
    });
  } catch (error) {
    logger.error('Error terminating lease:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to terminate lease',
    });
  }
};

export const renewLease = async (req, res) => {
  try {
    const { id } = req.params;
    const { newEndDate, newMonthlyRent } = req.body;

    const lease = await prisma.lease.findUnique({
      where: { id },
      include: {
        property: true,
        tenant: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!lease) {
      return res.status(404).json({
        error: 'Lease not found',
        message: 'Lease with this ID does not exist',
      });
    }

    // Check permissions
    const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager?.ownerId;
    if (lease.property.ownerId !== allowedOwnerId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only renew leases for your own properties',
      });
    }

    if (lease.status !== 'ACTIVE') {
      return res.status(400).json({
        error: 'Cannot renew lease',
        message: 'Only active leases can be renewed',
      });
    }

    const updatedLease = await prisma.lease.update({
      where: { id },
      data: {
        endDate: new Date(newEndDate),
        ...(newMonthlyRent && { monthlyRent: parseFloat(newMonthlyRent) }),
      },
    });

    // Send notification to tenant
    await sendNotificationToUser(lease.tenant.user.id, {
      title: 'Lease Renewed',
      body: `Your lease for ${lease.property.name} has been renewed until ${new Date(newEndDate).toLocaleDateString()}.`,
      type: 'lease',
      data: { leaseId: id },
    });

    logger.info(`Lease renewed: ${id} by ${req.user.email}`);

    res.json({
      message: 'Lease renewed successfully',
      lease: updatedLease,
    });
  } catch (error) {
    logger.error('Error renewing lease:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to renew lease',
    });
  }
};

export const getLeaseDocuments = async (req, res) => {
  try {
    const { id } = req.params;

    const lease = await prisma.lease.findUnique({
      where: { id },
      include: {
        property: true,
        documents: true,
      },
    });

    if (!lease) {
      return res.status(404).json({
        error: 'Lease not found',
        message: 'Lease with this ID does not exist',
      });
    }

    // Check permissions
    if (req.user.role === 'OWNER' && lease.property.ownerId !== req.user.owner.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access documents for your own properties',
      });
    }

    if (req.user.role === 'MANAGER' && lease.property.ownerId !== req.user.manager.ownerId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access documents for properties you manage',
      });
    }

    if (req.user.role === 'TENANT' && lease.tenantId !== req.user.tenant.id) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own lease documents',
      });
    }

    res.json({
      documents: lease.documents,
    });
  } catch (error) {
    logger.error('Error fetching lease documents:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch lease documents',
    });
  }
};
