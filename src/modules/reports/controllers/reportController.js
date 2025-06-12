
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { generatePaymentReceipt } from '../../../utils/pdfGenerator.js';
import { successResponse, errorResponse } from '../../../utils/responseHelpers.js';

export const getFinancialReport = async (req, res) => {
  try {
    const { startDate, endDate, propertyId, format = 'json' } = req.query;
    
    let where = {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    };

    // Apply role-based filtering
    if (req.user.role === 'OWNER') {
      where.lease = {
        property: {
          ownerId: req.user.owner.id
        }
      };
    } else if (req.user.role === 'MANAGER') {
      where.lease = {
        property: {
          ownerId: req.user.manager.ownerId
        }
      };
    }

    if (propertyId) {
      where.lease = {
        ...where.lease,
        propertyId
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        lease: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            tenant: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const summary = {
      totalRevenue: payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0),
      pendingRevenue: payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0),
      overdueRevenue: payments.filter(p => p.status === 'OVERDUE').reduce((sum, p) => sum + p.amount, 0),
      totalPayments: payments.length,
      paidPayments: payments.filter(p => p.status === 'PAID').length,
      pendingPayments: payments.filter(p => p.status === 'PENDING').length,
      overduePayments: payments.filter(p => p.status === 'OVERDUE').length
    };

    const reportData = {
      period: { startDate, endDate },
      summary,
      payments,
      generatedAt: new Date().toISOString()
    };

    if (format === 'pdf') {
      const pdfBuffer = await generatePaymentReceipt(reportData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=financial-report.pdf');
      return res.send(pdfBuffer);
    }

    successResponse(res, reportData, 'Financial report generated successfully');

  } catch (error) {
    logger.error('Error generating financial report:', error);
    errorResponse(res, 'Failed to generate financial report', 500);
  }
};

export const getOccupancyReport = async (req, res) => {
  try {
    const { startDate, endDate, propertyId } = req.query;
    
    let propertyWhere = {};
    
    if (req.user.role === 'OWNER') {
      propertyWhere.ownerId = req.user.owner.id;
    } else if (req.user.role === 'MANAGER') {
      propertyWhere.ownerId = req.user.manager.ownerId;
    }

    if (propertyId) {
      propertyWhere.id = propertyId;
    }

    const properties = await prisma.property.findMany({
      where: propertyWhere,
      include: {
        leases: {
          where: {
            OR: [
              {
                startDate: {
                  lte: new Date(endDate)
                },
                endDate: {
                  gte: new Date(startDate)
                }
              },
              {
                status: 'ACTIVE'
              }
            ]
          },
          include: {
            tenant: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    const occupancyData = properties.map(property => {
      const activeLease = property.leases.find(lease => lease.status === 'ACTIVE');
      const occupancyRate = property.units > 0 ? (activeLease ? 1 : 0) : 0;
      
      return {
        propertyId: property.id,
        propertyName: property.name,
        address: property.address,
        totalUnits: property.units,
        occupiedUnits: activeLease ? 1 : 0,
        occupancyRate: occupancyRate * 100,
        currentTenant: activeLease ? 
          `${activeLease.tenant.firstName} ${activeLease.tenant.lastName}` : null,
        leaseStartDate: activeLease?.startDate,
        leaseEndDate: activeLease?.endDate
      };
    });

    const summary = {
      totalProperties: properties.length,
      occupiedProperties: occupancyData.filter(p => p.occupiedUnits > 0).length,
      vacantProperties: occupancyData.filter(p => p.occupiedUnits === 0).length,
      averageOccupancyRate: occupancyData.reduce((sum, p) => sum + p.occupancyRate, 0) / properties.length
    };

    successResponse(res, {
      period: { startDate, endDate },
      summary,
      properties: occupancyData,
      generatedAt: new Date().toISOString()
    }, 'Occupancy report generated successfully');

  } catch (error) {
    logger.error('Error generating occupancy report:', error);
    errorResponse(res, 'Failed to generate occupancy report', 500);
  }
};

export const getMaintenanceReport = async (req, res) => {
  try {
    const { startDate, endDate, propertyId } = req.query;
    
    let where = {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    };

    if (req.user.role === 'OWNER') {
      where.property = {
        ownerId: req.user.owner.id
      };
    } else if (req.user.role === 'MANAGER') {
      where.property = {
        ownerId: req.user.manager.ownerId
      };
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        reporter: {
          select: {
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const summary = {
      totalComplaints: complaints.length,
      openComplaints: complaints.filter(c => c.status === 'OPEN').length,
      inProgressComplaints: complaints.filter(c => c.status === 'IN_PROGRESS').length,
      resolvedComplaints: complaints.filter(c => c.status === 'RESOLVED').length,
      closedComplaints: complaints.filter(c => c.status === 'CLOSED').length,
      byCategory: complaints.reduce((acc, complaint) => {
        acc[complaint.category] = (acc[complaint.category] || 0) + 1;
        return acc;
      }, {}),
      byPriority: complaints.reduce((acc, complaint) => {
        acc[complaint.priority] = (acc[complaint.priority] || 0) + 1;
        return acc;
      }, {})
    };

    successResponse(res, {
      period: { startDate, endDate },
      summary,
      complaints,
      generatedAt: new Date().toISOString()
    }, 'Maintenance report generated successfully');

  } catch (error) {
    logger.error('Error generating maintenance report:', error);
    errorResponse(res, 'Failed to generate maintenance report', 500);
  }
};
