import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { sendNotificationToUser } from '../../notifications/services/socketService.js';

export const createComplaint = async (req, res) => {
  try {
    const { title, description, category, priority, propertyId } = req.body;
    const userId = req.user.userId;

    // Verify property exists and check permissions for non-tenant users
    if (propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      });

      if (!property) {
        return res.status(404).json({
          error: 'Property not found',
          message: 'Property with this ID does not exist',
        });
      }

      // For tenants, verify they are associated with the property
      if (req.user.role === 'TENANT') {
        const tenantProperty = await prisma.tenant.findFirst({
          where: {
            id: req.user.tenant.id,
            properties: {
              some: { id: propertyId },
            },
          },
        });

        if (!tenantProperty) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You can only create complaints for properties you are associated with',
          });
        }
      }
    }

    const complaint = await prisma.complaint.create({
      data: {
        title,
        description,
        category: category || 'GENERAL',
        priority: priority || 'MEDIUM',
        status: 'OPEN',
        reporterId: userId,
        ...(propertyId && { propertyId }),
      },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            owner: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Send notification to property owner if complaint is for a specific property
    if (propertyId && complaint.property) {
      await sendNotificationToUser(complaint.property.owner.user.id, {
        title: 'New Complaint Received',
        body: `A new complaint has been submitted for ${complaint.property.name}: ${title}`,
        type: 'complaint',
        data: { complaintId: complaint.id },
      });
    }

    logger.info(`Complaint created: ${title} by ${req.user.email}`);

    res.status(201).json({
      message: 'Complaint created successfully',
      complaint,
    });
  } catch (error) {
    logger.error('Error creating complaint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create complaint',
    });
  }
};

export const getComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category, priority, propertyId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};

    // Apply role-based filtering
    if (req.user.role === 'OWNER') {
      where.OR = [
        { reporterId: req.user.userId },
        { property: { ownerId: req.user.owner.id } },
      ];
    } else if (req.user.role === 'MANAGER') {
      where.OR = [
        { reporterId: req.user.userId },
        { assignedToId: req.user.userId },
        { property: { ownerId: req.user.manager.ownerId } },
      ];
    } else if (req.user.role === 'TENANT') {
      where.reporterId = req.user.userId;
    }

    // Apply filters
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (propertyId) where.propertyId = propertyId;

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          reporter: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              email: true,
              role: true,
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
      prisma.complaint.count({ where }),
    ]);

    res.json({
      complaints,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching complaints:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch complaints',
    });
  }
};

export const getComplaintById = async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            owner: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!complaint) {
      return res.status(404).json({
        error: 'Complaint not found',
        message: 'Complaint with this ID does not exist',
      });
    }

    // Check permissions
    const canAccess = 
      req.user.role === 'SUPER_ADMIN' ||
      complaint.reporterId === req.user.userId ||
      complaint.assignedToId === req.user.userId ||
      (req.user.role === 'OWNER' && complaint.property?.owner.user.id === req.user.userId) ||
      (req.user.role === 'MANAGER' && complaint.property?.owner.id === req.user.manager.ownerId);

    if (!canAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this complaint',
      });
    }

    res.json(complaint);
  } catch (error) {
    logger.error('Error fetching complaint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch complaint',
    });
  }
};

export const updateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, priority, status } = req.body;

    const existingComplaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            owner: true,
          },
        },
      },
    });

    if (!existingComplaint) {
      return res.status(404).json({
        error: 'Complaint not found',
        message: 'Complaint with this ID does not exist',
      });
    }

    // Check permissions
    const canUpdate = 
      req.user.role === 'SUPER_ADMIN' ||
      existingComplaint.reporterId === req.user.userId ||
      existingComplaint.assignedToId === req.user.userId ||
      (req.user.role === 'OWNER' && existingComplaint.property?.ownerId === req.user.owner.id) ||
      (req.user.role === 'MANAGER' && existingComplaint.property?.ownerId === req.user.manager.ownerId);

    if (!canUpdate) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to update this complaint',
      });
    }

    // Only allow reporter to update title and description, others can update status and priority
    const updateData = {};
    if (existingComplaint.reporterId === req.user.userId) {
      if (title) updateData.title = title;
      if (description) updateData.description = description;
    }

    if (category && req.user.role !== 'TENANT') updateData.category = category;
    if (priority && req.user.role !== 'TENANT') updateData.priority = priority;
    if (status && req.user.role !== 'TENANT') updateData.status = status;

    const updatedComplaint = await prisma.complaint.update({
      where: { id },
      data: updateData,
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            role: true,
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

    // Send notification if status changed
    if (status && status !== existingComplaint.status) {
      await sendNotificationToUser(existingComplaint.reporterId, {
        title: 'Complaint Status Updated',
        body: `Your complaint "${existingComplaint.title}" status has been updated to ${status}`,
        type: 'complaint',
        data: { complaintId: id },
      });
    }

    logger.info(`Complaint updated: ${id} by ${req.user.email}`);

    res.json({
      message: 'Complaint updated successfully',
      complaint: updatedComplaint,
    });
  } catch (error) {
    logger.error('Error updating complaint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update complaint',
    });
  }
};

export const deleteComplaint = async (req, res) => {
  try {
    const { id } = req.params;

    const existingComplaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        property: true,
      },
    });

    if (!existingComplaint) {
      return res.status(404).json({
        error: 'Complaint not found',
        message: 'Complaint with this ID does not exist',
      });
    }

    // Check permissions
    const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;
    if (existingComplaint.property && existingComplaint.property.ownerId !== allowedOwnerId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete complaints for properties you manage',
      });
    }

    await prisma.complaint.delete({
      where: { id },
    });

    logger.info(`Complaint deleted: ${id} by ${req.user.email}`);

    res.json({
      message: 'Complaint deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting complaint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete complaint',
    });
  }
};

export const assignComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        property: true,
      },
    });

    if (!complaint) {
      return res.status(404).json({
        error: 'Complaint not found',
        message: 'Complaint with this ID does not exist',
      });
    }

    // Verify manager exists and belongs to the owner
    const manager = await prisma.manager.findUnique({
      where: { id: managerId },
    });

    if (!manager) {
      return res.status(404).json({
        error: 'Manager not found',
        message: 'Manager with this ID does not exist',
      });
    }

    const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;
    if (manager.ownerId !== allowedOwnerId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only assign complaints to your own managers',
      });
    }

    const updatedComplaint = await prisma.complaint.update({
      where: { id },
      data: {
        assignedToId: managerId,
        status: 'IN_PROGRESS',
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Send notification to assigned manager
    await sendNotificationToUser(managerId, {
      title: 'Complaint Assigned',
      body: `You have been assigned a new complaint: "${complaint.title}"`,
      type: 'complaint',
      data: { complaintId: id },
    });

    logger.info(`Complaint assigned: ${id} to ${managerId} by ${req.user.email}`);

    res.json({
      message: 'Complaint assigned successfully',
      complaint: updatedComplaint,
    });
  } catch (error) {
    logger.error('Error assigning complaint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to assign complaint',
    });
  }
};

export const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      return res.status(404).json({
        error: 'Complaint not found',
        message: 'Complaint with this ID does not exist',
      });
    }

    const updateData = { status };
    if (status === 'RESOLVED' && resolution) {
      updateData.resolution = resolution;
      updateData.resolvedAt = new Date();
    }

    const updatedComplaint = await prisma.complaint.update({
      where: { id },
      data: updateData,
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            role: true,
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

    // Send notification to reporter
    await sendNotificationToUser(complaint.reporterId, {
      title: 'Complaint Status Updated',
      body: `Your complaint "${complaint.title}" status has been updated to ${status}`,
      type: 'complaint',
      data: { complaintId: id },
    });

    logger.info(`Complaint status updated: ${id} to ${status} by ${req.user.email}`);

    res.json({
      message: 'Complaint status updated successfully',
      complaint: updatedComplaint,
    });
  } catch (error) {
    logger.error('Error updating complaint status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update complaint status',
    });
  }
};

export const resolveComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        property: true,
      },
    });

    if (!complaint) {
      return res.status(404).json({
        error: 'Complaint not found',
        message: 'Complaint with this ID does not exist',
      });
    }

    // Check permissions
    const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;
    if (complaint.property && complaint.property.ownerId !== allowedOwnerId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only resolve complaints for properties you manage',
      });
    }

    const updatedComplaint = await prisma.complaint.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedAt: new Date(),
        resolvedById: req.user.id,
      },
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Send notification to complaint reporter
    await sendNotificationToUser(complaint.reporterId, {
      title: 'Complaint Resolved',
      body: `Your complaint "${complaint.title}" has been resolved`,
      type: 'complaint',
      data: { complaintId: id },
    });

    logger.info(`Complaint resolved: ${id} by ${req.user.email}`);

    res.json({
      message: 'Complaint resolved successfully',
      complaint: updatedComplaint,
    });
  } catch (error) {
    logger.error('Error resolving complaint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to resolve complaint',
    });
  }
};