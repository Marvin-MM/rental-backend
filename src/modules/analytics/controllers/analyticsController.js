import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { asyncHandler } from '../../../middleware/errorHandler.js';
import { successResponse, errorResponse } from '../../../utils/responseHelpers.js';
import { generatePdfReport, generateCsvReport } from '../../../utils/pdfGenerator.js';

const buildScopeWhereClause = (user) => {
  const where = {};
  if (user.role === 'OWNER') {
    where.property = { ownerId: user.owner.id };
  } else if (user.role === 'MANAGER') {
    where.property = { ownerId: user.manager.ownerId };
  }
  return where;
};

export const getDashboardStats = asyncHandler(async (req, res) => {
  const scopeWhere = buildScopeWhereClause(req.user);

  const [
    totalProperties,
    activeTenants,
    activeLeases,
    openMaintenance,
    pendingPayments,
    totalRevenueLast30Days,
  ] = await prisma.$transaction([
    prisma.property.count({ where: scopeWhere.property }),
    prisma.tenant.count({ where: { property: scopeWhere.property, isActive: true } }),
    prisma.lease.count({ where: { ...scopeWhere, status: 'ACTIVE' } }),
    prisma.maintenanceRequest.count({ where: { ...scopeWhere, status: 'OPEN' } }),
    prisma.payment.aggregate({
      where: { lease: scopeWhere, status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        lease: scopeWhere,
        status: 'PAID',
        paidDate: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) },
      },
      _sum: { amount: true },
    }),
  ]);

  const stats = {
    totalProperties,
    activeTenants,
    activeLeases,
    openMaintenance,
    pendingPayments: pendingPayments._sum.amount || 0,
    totalRevenueLast30Days: totalRevenueLast30Days._sum.amount || 0,
  };

  return successResponse(res, stats, 'Dashboard statistics retrieved successfully.');
});

export const getRevenueAnalytics = asyncHandler(async (req, res) => {
    const scopeWhere = buildScopeWhereClause(req.user);

    const revenue = await prisma.payment.aggregate({
        where: {
            lease: scopeWhere,
            status: 'PAID'
        },
        _sum: {
            amount: true,
        },
    });

    return successResponse(res, { totalRevenue: revenue._sum.amount || 0 }, 'Revenue analytics retrieved.');
});

export const getOccupancyAnalytics = asyncHandler(async (req, res) => {
    const scopeWhere = buildScopeWhereClause(req.user);

    const properties = await prisma.property.findMany({
        where: scopeWhere.property,
        include: {
            _count: {
                select: { leases: { where: { status: 'ACTIVE' } } }
            }
        }
    });

    const totalUnits = properties.reduce((sum, p) => sum + p.units, 0);
    const occupiedUnits = properties.reduce((sum, p) => sum + p._count.leases, 0);
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    const data = {
        totalUnits,
        occupiedUnits,
        vacantUnits: totalUnits - occupiedUnits,
        occupancyRate: parseFloat(occupancyRate.toFixed(2)),
    };

    return successResponse(res, data, 'Occupancy analytics retrieved.');
});

export const getTenantAnalytics = asyncHandler(async (req, res) => {
    const scopeWhere = { property: buildScopeWhereClause(req.user).property };

    const totalTenants = await prisma.tenant.count({ where: scopeWhere });
    const activeTenants = await prisma.tenant.count({ where: { ...scopeWhere, isActive: true } });

    return successResponse(res, { totalTenants, activeTenants, inactiveTenants: totalTenants - activeTenants }, 'Tenant analytics retrieved.');
});

export const getPropertyAnalytics = asyncHandler(async (req, res) => {
    const scopeWhere = buildScopeWhereClause(req.user).property;
    const properties = await prisma.property.findMany({
        where: scopeWhere,
        select: {
            status: true,
            type: true,
        }
    });

    const statusCounts = properties.reduce((acc, property) => {
        acc[property.status] = (acc[property.status] || 0) + 1;
        return acc;
    }, {});

    const typeCounts = properties.reduce((acc, property) => {
        acc[property.type] = (acc[property.type] || 0) + 1;
        return acc;
    }, {});


    return successResponse(res, { totalProperties: properties.length, byStatus: statusCounts, byType: typeCounts }, 'Property analytics retrieved.');
});

export const getComplaintAnalytics = asyncHandler(async (req, res) => {
    const scopeWhere = buildScopeWhereClause(req.user);
    const complaints = await prisma.complaint.findMany({
        where: { property: scopeWhere.property },
        select: { status: true, priority: true }
    });

    const statusCounts = complaints.reduce((acc, complaint) => {
        acc[complaint.status] = (acc[complaint.status] || 0) + 1;
        return acc;
    }, {});

    const priorityCounts = complaints.reduce((acc, complaint) => {
        acc[complaint.priority] = (acc[complaint.priority] || 0) + 1;
        return acc;
    }, {});

    return successResponse(res, { totalComplaints: complaints.length, byStatus: statusCounts, byPriority: priorityCounts }, 'Complaint analytics retrieved.');
});

export const getPaymentAnalytics = asyncHandler(async (req, res) => {
    const scopeWhere = buildScopeWhereClause(req.user);
    const payments = await prisma.payment.findMany({
        where: { lease: scopeWhere },
        select: { status: true, amount: true, method: true }
    });

    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const statusCounts = {};
    const methodCounts = {};
    
    for (const payment of payments) {
        statusCounts[payment.status] = (statusCounts[payment.status] || 0) + 1;
        if(payment.method) {
            methodCounts[payment.method] = (methodCounts[payment.method] || 0) + 1;
        }
    }

    return successResponse(res, { totalPayments: payments.length, totalAmount, byStatus: statusCounts, byMethod: methodCounts }, 'Payment analytics retrieved.');
});

export const exportAnalyticsReport = asyncHandler(async (req, res) => {
    const { type, format = 'pdf' } = req.query;
    const scopeWhere = buildScopeWhereClause(req.user);
    let data;
    let reportTitle = '';
    let headers = [];

    switch(type) {
        case 'revenue':
            data = await prisma.payment.findMany({ where: { lease: scopeWhere, status: 'PAID' }, select: { id: true, amount: true, paidDate: true, lease: { select: { property: { select: { name: true } } } } } });
            reportTitle = 'Revenue Report';
            headers = [
                { id: 'id', title: 'Payment ID' },
                { id: 'property', title: 'Property', path: 'lease.property.name' },
                { id: 'paidDate', title: 'Paid Date' },
                { id: 'amount', title: 'Amount' },
            ];
            break;
        case 'occupancy':
             const properties = await prisma.property.findMany({
                where: scopeWhere.property,
                include: { _count: { select: { leases: { where: { status: 'ACTIVE' } } } } }
            });
            data = properties.map(p => ({
                name: p.name,
                address: p.address,
                units: p.units,
                occupied: p.units > 0 ? (p._count.leases > 0 ? 'Yes' : 'No') : 'N/A'
            }));
            reportTitle = 'Occupancy Report';
            headers = [
                { id: 'name', title: 'Property Name' },
                { id: 'address', title: 'Address' },
                { id: 'units', title: 'Units' },
                { id: 'occupied', title: 'Occupied' },
            ];
            break;
        default:
            return errorResponse(res, 'Invalid report type', 400);
    }
    
    if (format === 'pdf') {
        const pdfBuffer = await generatePdfReport(data, reportTitle, headers);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${type}-report.pdf`);
        return res.send(pdfBuffer);
    }

    if(format === 'csv') {
        const csv = await generateCsvReport(data, headers);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${type}-report.csv`);
        return res.send(csv);
    }

    return errorResponse(res, 'Invalid format specified', 400);
});
