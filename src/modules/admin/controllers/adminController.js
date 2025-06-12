
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { successResponse, errorResponse } from '../../../utils/responseHelpers.js';
import { hashPassword } from '../../../utils/helpers.js';

export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalProperties,
      totalTenants,
      totalOwners,
      totalManagers,
      activeLeases,
      pendingPayments,
      openComplaints,
      openMaintenanceRequests,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.owner.count(),
      prisma.manager.count(),
      prisma.lease.count({ where: { status: 'ACTIVE' } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.complaint.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.maintenanceRequest.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ]);

    // Recent activities
    const recentActivities = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Revenue data for last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const revenueData = await prisma.payment.groupBy({
      by: ['createdAt'],
      where: {
        status: 'PAID',
        createdAt: {
          gte: twelveMonthsAgo,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const stats = {
      overview: {
        totalUsers,
        totalProperties,
        totalTenants,
        totalOwners,
        totalManagers,
        activeLeases,
        pendingPayments,
        openComplaints,
        openMaintenanceRequests,
      },
      recentActivities,
      revenueData,
    };

    return successResponse(res, 'Dashboard stats retrieved successfully', stats);
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    return errorResponse(res, 'Failed to retrieve dashboard stats');
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (role) where.role = role;
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLogin: true,
          tenant: {
            select: {
              id: true,
              phone: true,
            },
          },
          owner: {
            select: {
              id: true,
              phone: true,
            },
          },
          manager: {
            select: {
              id: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return successResponse(res, 'Users retrieved successfully', {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error getting users:', error);
    return errorResponse(res, 'Failed to retrieve users');
  }
};

export const createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, phone, address } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return errorResponse(res, 'User with this email already exists', 400);
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Create role-specific record
    if (role === 'TENANT') {
      await prisma.tenant.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          phone: phone || '',
          address: address || '',
          isActive: true,
        },
      });
    } else if (role === 'OWNER') {
      await prisma.owner.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          phone: phone || '',
          address: address || '',
        },
      });
    } else if (role === 'MANAGER') {
      await prisma.manager.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          phone: phone || '',
          address: address || '',
          isActive: true,
        },
      });
    }

    logger.info(`User created by admin: ${user.email} (${user.role})`);

    return successResponse(res, 'User created successfully', user, 201);
  } catch (error) {
    logger.error('Error creating user:', error);
    return errorResponse(res, 'Failed to create user');
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, isActive, phone, address } = req.body;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        tenant: true,
        owner: true,
        manager: true,
      },
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(typeof isActive === 'boolean' && { isActive }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // Update role-specific record
    const roleUpdateData = {};
    if (firstName) roleUpdateData.firstName = firstName;
    if (lastName) roleUpdateData.lastName = lastName;
    if (phone) roleUpdateData.phone = phone;
    if (address) roleUpdateData.address = address;

    if (Object.keys(roleUpdateData).length > 0) {
      if (user.tenant) {
        await prisma.tenant.update({
          where: { userId: id },
          data: roleUpdateData,
        });
      } else if (user.owner) {
        await prisma.owner.update({
          where: { userId: id },
          data: roleUpdateData,
        });
      } else if (user.manager) {
        await prisma.manager.update({
          where: { userId: id },
          data: roleUpdateData,
        });
      }
    }

    logger.info(`User updated by admin: ${updatedUser.email}`);

    return successResponse(res, 'User updated successfully', updatedUser);
  } catch (error) {
    logger.error('Error updating user:', error);
    return errorResponse(res, 'Failed to update user');
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        tenant: true,
        owner: true,
        manager: true,
      },
    });

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Check if user can be deleted (no active relationships)
    if (user.role === 'OWNER') {
      const activeProperties = await prisma.property.count({
        where: { ownerId: user.owner?.id },
      });
      if (activeProperties > 0) {
        return errorResponse(res, 'Cannot delete owner with active properties', 400);
      }
    }

    if (user.role === 'TENANT') {
      const activeLeases = await prisma.lease.count({
        where: {
          tenantId: user.tenant?.id,
          status: 'ACTIVE',
        },
      });
      if (activeLeases > 0) {
        return errorResponse(res, 'Cannot delete tenant with active leases', 400);
      }
    }

    // Delete role-specific record first
    if (user.tenant) {
      await prisma.tenant.delete({ where: { userId: id } });
    } else if (user.owner) {
      await prisma.owner.delete({ where: { userId: id } });
    } else if (user.manager) {
      await prisma.manager.delete({ where: { userId: id } });
    }

    // Delete user
    await prisma.user.delete({ where: { id } });

    logger.info(`User deleted by admin: ${user.email}`);

    return successResponse(res, 'User deleted successfully');
  } catch (error) {
    logger.error('Error deleting user:', error);
    return errorResponse(res, 'Failed to delete user');
  }
};

export const getSystemSettings = async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = {
        value: setting.value,
        type: setting.type,
        description: setting.description,
      };
      return acc;
    }, {});

    return successResponse(res, 'System settings retrieved successfully', settingsMap);
  } catch (error) {
    logger.error('Error getting system settings:', error);
    return errorResponse(res, 'Failed to retrieve system settings');
  }
};

export const updateSystemSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: {
        key,
        value,
        type: 'STRING',
        description: '',
      },
    });

    logger.info(`System setting updated: ${key} by ${req.user.email}`);

    return successResponse(res, 'System setting updated successfully', setting);
  } catch (error) {
    logger.error('Error updating system setting:', error);
    return errorResponse(res, 'Failed to update system setting');
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, action, userId, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return successResponse(res, 'Audit logs retrieved successfully', {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error getting audit logs:', error);
    return errorResponse(res, 'Failed to retrieve audit logs');
  }
};
