import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { successResponse, errorResponse } from '../../../utils/responseHelpers.js';

export const getCalendarEvents = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    const userId = req.user.userId;

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    const events = [];

    // Get payments due
    if (!type || type === 'payment') {
      const where = {
        dueDate: {
          gte: start,
          lte: end,
        },
        status: 'PENDING',
      };

      if (req.user.role === 'TENANT') {
        where.tenantId = req.user.tenant.id;
      } else if (req.user.role === 'OWNER') {
        where.lease = {
          property: {
            ownerId: req.user.owner.id,
          },
        };
      } else if (req.user.role === 'MANAGER') {
        const managerProperties = await prisma.property.findMany({
          where: {
            managers: {
              some: { userId },
            },
          },
          select: { id: true },
        });

        where.lease = {
          propertyId: {
            in: managerProperties.map(p => p.id),
          },
        };
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          tenant: {
            include: {
              user: true,
            },
          },
          lease: {
            include: {
              property: true,
            },
          },
        },
      });

      payments.forEach(payment => {
        events.push({
          id: `payment-${payment.id}`,
          title: `Payment Due: $${payment.amount}`,
          description: `Payment due for ${payment.lease.property.name}`,
          start: payment.dueDate,
          end: payment.dueDate,
          type: 'payment',
          status: payment.status,
          allDay: true,
          data: payment,
        });
      });
    }

    // Get lease start/end dates
    if (!type || type === 'lease') {
      const leaseWhere = {
        OR: [
          {
            startDate: {
              gte: start,
              lte: end,
            },
          },
          {
            endDate: {
              gte: start,
              lte: end,
            },
          },
        ],
      };

      if (req.user.role === 'TENANT') {
        leaseWhere.tenantId = req.user.tenant.id;
      } else if (req.user.role === 'OWNER') {
        leaseWhere.property = {
          ownerId: req.user.owner.id,
        };
      } else if (req.user.role === 'MANAGER') {
        const managerProperties = await prisma.property.findMany({
          where: {
            managers: {
              some: { userId },
            },
          },
          select: { id: true },
        });

        leaseWhere.propertyId = {
          in: managerProperties.map(p => p.id),
        };
      }

      const leases = await prisma.lease.findMany({
        where: leaseWhere,
        include: {
          tenant: {
            include: {
              user: true,
            },
          },
          property: true,
        },
      });

      leases.forEach(lease => {
        // Lease start
        if (lease.startDate >= start && lease.startDate <= end) {
          events.push({
            id: `lease-start-${lease.id}`,
            title: `Lease Starts: ${lease.property.name}`,
            description: `Lease begins for ${lease.tenant.user.firstName} ${lease.tenant.user.lastName}`,
            start: lease.startDate,
            end: lease.startDate,
            type: 'lease-start',
            allDay: true,
            data: lease,
          });
        }

        // Lease end
        if (lease.endDate >= start && lease.endDate <= end) {
          events.push({
            id: `lease-end-${lease.id}`,
            title: `Lease Ends: ${lease.property.name}`,
            description: `Lease expires for ${lease.tenant.user.firstName} ${lease.tenant.user.lastName}`,
            start: lease.endDate,
            end: lease.endDate,
            type: 'lease-end',
            allDay: true,
            data: lease,
          });
        }
      });
    }

    // Get maintenance requests
    if (!type || type === 'maintenance') {
      const maintenanceWhere = {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: {
          in: ['OPEN', 'IN_PROGRESS'],
        },
      };

      if (req.user.role === 'TENANT') {
        maintenanceWhere.requestedById = userId;
      } else if (req.user.role === 'MANAGER') {
        maintenanceWhere.assignedToId = userId;
      } else if (req.user.role === 'OWNER') {
        maintenanceWhere.property = {
          ownerId: req.user.owner.id,
        };
      }

      const maintenanceRequests = await prisma.maintenanceRequest.findMany({
        where: maintenanceWhere,
        include: {
          property: true,
          requestedBy: true,
        },
      });

      maintenanceRequests.forEach(request => {
        events.push({
          id: `maintenance-${request.id}`,
          title: `Maintenance: ${request.title}`,
          description: request.description,
          start: request.createdAt,
          end: request.createdAt,
          type: 'maintenance',
          priority: request.priority,
          status: request.status,
          allDay: true,
          data: request,
        });
      });
    }

    // Sort events by date
    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    return successResponse(res, 'Calendar events retrieved successfully', events);
  } catch (error) {
    logger.error('Error getting calendar events:', error);
    return errorResponse(res, 'Failed to retrieve calendar events');
  }
};

export const getUpcomingEvents = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const userId = req.user.userId;

    const start = new Date();
    const end = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000);

    const events = [];

    // Get upcoming payments
    const paymentWhere = {
      dueDate: {
        gte: start,
        lte: end,
      },
      status: 'PENDING',
    };

    if (req.user.role === 'TENANT') {
      paymentWhere.tenantId = req.user.tenant.id;
    } else if (req.user.role === 'OWNER') {
      paymentWhere.lease = {
        property: {
          ownerId: req.user.owner.id,
        },
      };
    }

    const upcomingPayments = await prisma.payment.findMany({
      where: paymentWhere,
      include: {
        tenant: {
          include: {
            user: true,
          },
        },
        lease: {
          include: {
            property: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });

    upcomingPayments.forEach(payment => {
      events.push({
        id: `payment-${payment.id}`,
        title: `Payment Due: $${payment.amount}`,
        description: `Payment due for ${payment.lease.property.name}`,
        date: payment.dueDate,
        type: 'payment',
        priority: 'high',
        data: payment,
      });
    });

    // Get upcoming lease expirations
    const leaseWhere = {
      endDate: {
        gte: start,
        lte: end,
      },
      status: 'ACTIVE',
    };

    if (req.user.role === 'TENANT') {
      leaseWhere.tenantId = req.user.tenant.id;
    } else if (req.user.role === 'OWNER') {
      leaseWhere.property = {
        ownerId: req.user.owner.id,
      };
    }

    const expiringLeases = await prisma.lease.findMany({
      where: leaseWhere,
      include: {
        tenant: {
          include: {
            user: true,
          },
        },
        property: true,
      },
      orderBy: { endDate: 'asc' },
      take: 5,
    });

    expiringLeases.forEach(lease => {
      events.push({
        id: `lease-end-${lease.id}`,
        title: `Lease Expiring: ${lease.property.name}`,
        description: `Lease expires for ${lease.tenant.user.firstName} ${lease.tenant.user.lastName}`,
        date: lease.endDate,
        type: 'lease-expiration',
        priority: 'medium',
        data: lease,
      });
    });

    // Sort events by date
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    return successResponse(res, 'Upcoming events retrieved successfully', events);
  } catch (error) {
    logger.error('Error getting upcoming events:', error);
    return errorResponse(res, 'Failed to retrieve upcoming events');
  }
};

export const createCalendarEvent = async (req, res) => {
  try {
    const { title, description, startDate, endDate, type, relatedId } = req.body;
    const userId = req.user.userId;

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type,
        relatedId,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Calendar event created: ${event.id} by ${req.user.email}`);

    return successResponse(res, 'Calendar event created successfully', event, 201);
  } catch (error) {
    logger.error('Error creating calendar event:', error);
    return errorResponse(res, 'Failed to create calendar event');
  }
};