
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { successResponse, errorResponse } from '../../../utils/responseHelpers.js';
import { sendNotificationToUser } from '../../notifications/services/socketService.js';
import { sendEmail } from '../../notifications/services/emailService.js';

export const createMaintenanceRequest = async (req, res) => {
  try {
    const { title, description, priority, category, propertyId, urgency } = req.body;
    const userId = req.user.userId;

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owner: {
          include: { user: true },
        },
        managers: {
          include: { user: true },
        },
      },
    });

    if (!property) {
      return errorResponse(res, 'Property not found', 404);
    }

    // Check if user has permission to create maintenance request for this property
    if (req.user.role === 'TENANT') {
      const tenant = await prisma.tenant.findFirst({
        where: {
          userId,
          properties: {
            some: { id: propertyId },
          },
        },
      });

      if (!tenant) {
        return errorResponse(res, 'You can only create maintenance requests for your assigned properties', 403);
      }
    }

    const maintenanceRequest = await prisma.maintenanceRequest.create({
      data: {
        title,
        description,
        priority,
        category,
        urgency,
        propertyId,
        requestedById: userId,
        status: 'OPEN',
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
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

    // Notify property owner and managers
    const notificationPromises = [];
    
    if (property.owner) {
      notificationPromises.push(
        sendNotificationToUser(property.owner.userId, {
          title: 'New Maintenance Request',
          body: `New maintenance request: ${title}`,
          type: 'maintenance',
          data: { maintenanceRequestId: maintenanceRequest.id },
        })
      );
    }

    property.managers.forEach((manager) => {
      notificationPromises.push(
        sendNotificationToUser(manager.userId, {
          title: 'New Maintenance Request',
          body: `New maintenance request: ${title}`,
          type: 'maintenance',
          data: { maintenanceRequestId: maintenanceRequest.id },
        })
      );
    });

    await Promise.all(notificationPromises);

    logger.info(`Maintenance request created: ${maintenanceRequest.id} by ${req.user.email}`);

    return successResponse(res, 'Maintenance request created successfully', maintenanceRequest, 201);
  } catch (error) {
    logger.error('Error creating maintenance request:', error);
    return errorResponse(res, 'Failed to create maintenance request');
  }
};

export const getMaintenanceRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, priority, category, propertyId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    // Apply role-based filtering
    if (req.user.role === 'TENANT') {
      where.requestedById = req.user.userId;
    } else if (req.user.role === 'MANAGER') {
      const managerProperties = await prisma.property.findMany({
        where: {
          managers: {
            some: { userId: req.user.userId },
          },
        },
        select: { id: true },
      });
      where.propertyId = {
        in: managerProperties.map((p) => p.id),
      };
    } else if (req.user.role === 'OWNER') {
      where.property = {
        ownerId: req.user.owner.id,
      };
    }

    // Apply filters
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (propertyId) where.propertyId = propertyId;

    const [requests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          requestedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);

    return successResponse(res, 'Maintenance requests retrieved successfully', {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error getting maintenance requests:', error);
    return errorResponse(res, 'Failed to retrieve maintenance requests');
  }
};

export const getMaintenanceRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        requestedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        updates: {
          include: {
            updatedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!request) {
      return errorResponse(res, 'Maintenance request not found', 404);
    }

    // Check permissions
    const hasAccess =
      req.user.role === 'SUPER_ADMIN' ||
      request.requestedById === req.user.userId ||
      (req.user.role === 'OWNER' && request.property.ownerId === req.user.owner?.id) ||
      (req.user.role === 'MANAGER' && request.assignedToId === req.user.userId);

    if (!hasAccess) {
      return errorResponse(res, 'Access denied', 403);
    }

    return successResponse(res, 'Maintenance request retrieved successfully', request);
  } catch (error) {
    logger.error('Error getting maintenance request:', error);
    return errorResponse(res, 'Failed to retrieve maintenance request');
  }
};

export const updateMaintenanceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, category, urgency, status, resolution } = req.body;

    const request = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            owner: true,
          },
        },
      },
    });

    if (!request) {
      return errorResponse(res, 'Maintenance request not found', 404);
    }

    // Check permissions
    const canUpdate =
      req.user.role === 'SUPER_ADMIN' ||
      (req.user.role === 'OWNER' && request.property.ownerId === req.user.owner?.id) ||
      (req.user.role === 'MANAGER' && request.assignedToId === req.user.userId);

    if (!canUpdate) {
      return errorResponse(res, 'Access denied', 403);
    }

    const updatedRequest = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(priority && { priority }),
        ...(category && { category }),
        ...(urgency && { urgency }),
        ...(status && { status }),
        ...(resolution && { resolution }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
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

    // Create update log
    await prisma.maintenanceUpdate.create({
      data: {
        maintenanceRequestId: id,
        updatedById: req.user.userId,
        changes: req.body,
        description: `Request updated by ${req.user.firstName} ${req.user.lastName}`,
      },
    });

    // Send notification if status changed
    if (status && status !== request.status) {
      await sendNotificationToUser(request.requestedById, {
        title: 'Maintenance Request Updated',
        body: `Your maintenance request status has been updated to: ${status}`,
        type: 'maintenance',
        data: { maintenanceRequestId: id },
      });
    }

    logger.info(`Maintenance request updated: ${id} by ${req.user.email}`);

    return successResponse(res, 'Maintenance request updated successfully', updatedRequest);
  } catch (error) {
    logger.error('Error updating maintenance request:', error);
    return errorResponse(res, 'Failed to update maintenance request');
  }
};

export const assignMaintenanceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    const request = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            owner: true,
          },
        },
      },
    });

    if (!request) {
      return errorResponse(res, 'Maintenance request not found', 404);
    }

    // Verify assignee exists and has appropriate role
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
    });

    if (!assignee || !['MANAGER', 'OWNER'].includes(assignee.role)) {
      return errorResponse(res, 'Invalid assignee', 400);
    }

    const updatedRequest = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        assignedToId,
        status: 'IN_PROGRESS',
        assignedAt: new Date(),
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Send notification to assignee
    await sendNotificationToUser(assignedToId, {
      title: 'Maintenance Request Assigned',
      body: `You have been assigned a maintenance request: ${request.title}`,
      type: 'maintenance',
      data: { maintenanceRequestId: id },
    });

    logger.info(`Maintenance request assigned: ${id} to ${assignee.email} by ${req.user.email}`);

    return successResponse(res, 'Maintenance request assigned successfully', updatedRequest);
  } catch (error) {
    logger.error('Error assigning maintenance request:', error);
    return errorResponse(res, 'Failed to assign maintenance request');
  }
};

export const deleteMaintenanceRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            owner: true,
          },
        },
      },
    });

    if (!request) {
      return errorResponse(res, 'Maintenance request not found', 404);
    }

    // Check permissions
    const canDelete =
      req.user.role === 'SUPER_ADMIN' ||
      (req.user.role === 'OWNER' && request.property.ownerId === req.user.owner?.id) ||
      request.requestedById === req.user.userId;

    if (!canDelete) {
      return errorResponse(res, 'Access denied', 403);
    }

    await prisma.maintenanceRequest.delete({
      where: { id },
    });

    logger.info(`Maintenance request deleted: ${id} by ${req.user.email}`);

    return successResponse(res, 'Maintenance request deleted successfully');
  } catch (error) {
    logger.error('Error deleting maintenance request:', error);
    return errorResponse(res, 'Failed to delete maintenance request');
  }
};
