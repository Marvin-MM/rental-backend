
import prisma from '../config/database.js';
import logger from '../config/logger.js';

export const logActivity = async (action, userId, resourceType, resourceId, details = {}) => {
  try {
    const auditLog = await prisma.auditLog.create({
      data: {
        action,
        userId,
        resourceType,
        resourceId,
        details,
        ipAddress: details.ipAddress || null,
        userAgent: details.userAgent || null,
        timestamp: new Date()
      }
    });

    logger.info(`Audit log created: ${action} by user ${userId} on ${resourceType}:${resourceId}`);
    return auditLog;

  } catch (error) {
    logger.error('Error creating audit log:', error);
    throw error;
  }
};

export const getAuditLogs = async (filters = {}) => {
  try {
    const {
      userId,
      resourceType,
      resourceId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = filters;

    const where = {};
    if (userId) where.userId = userId;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    if (action) where.action = action;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

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
              role: true
            }
          }
        },
        orderBy: { timestamp: 'desc' }
      }),
      prisma.auditLog.count({ where })
    ]);

    return {
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    };

  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    throw error;
  }
};
