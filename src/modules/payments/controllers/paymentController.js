import { asyncHandler } from '../../../middleware/errorHandler.js';
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { generatePaymentReceipt as generatePdf } from '../../../utils/pdfGenerator.js';
import { sendPaymentConfirmationEmail, sendPaymentReminderEmail } from '../../notifications/services/emailService.js';
import { uploadToCloudinary } from '../../../utils/cloudinary.js';
import { successResponse, errorResponse } from '../../../utils/responseHelpers.js';

export const getPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, tenantId, propertyId, startDate, endDate } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  if (req.user.role === 'TENANT') {
    where.tenantId = req.user.tenant.id;
  } else if (req.user.role === 'OWNER') {
    where.lease = {
      property: { ownerId: req.user.owner.id },
    };
  } else if (req.user.role === 'MANAGER') {
    where.lease = {
      property: { ownerId: req.user.manager.ownerId },
    };
  }

  if (status) where.status = status;
  if (tenantId) where.tenantId = tenantId;
  if (propertyId) {
    where.lease = { ...where.lease, propertyId };
  }

  if (startDate || endDate) {
    where.dueDate = {};
    if (startDate) where.dueDate.gte = new Date(startDate);
    if (endDate) where.dueDate.lte = new Date(endDate);
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
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
        lease: {
          select: {
            id: true,
            property: {
              select: {
                id: true,
                name: true,
                address: true,
              },
            },
          },
        },
        receipts: {
          select: {
            id: true,
            pdfUrl: true,
            generatedAt: true,
          },
        },
      },
      orderBy: { dueDate: 'desc' },
    }),
    prisma.payment.count({ where }),
  ]);

  return successResponse(res, {
    payments,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

export const getPaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      tenant: {
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      },
      lease: {
        include: {
          property: {
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
          },
        },
      },
      receipts: true,
    },
  });

  if (!payment) {
    return errorResponse(res, 'Payment not found', 404);
  }

  if (req.user.role === 'TENANT' && payment.tenantId !== req.user.tenant.id) {
    return errorResponse(res, 'You can only access your own payments', 403);
  }

  if (req.user.role === 'OWNER' && payment.lease.property.ownerId !== req.user.owner.id) {
    return errorResponse(res, 'You can only access payments for your properties', 403);
  }

  if (req.user.role === 'MANAGER' && payment.lease.property.ownerId !== req.user.manager.ownerId) {
    return errorResponse(res, 'You can only access payments for properties you manage', 403);
  }

  return successResponse(res, { payment });
});

export const createPayment = asyncHandler(async (req, res) => {
  const { tenantId, leaseId, amount, dueDate, notes } = req.body;

  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      tenant: true,
      property: true,
    },
  });

  if (!lease) {
    return errorResponse(res, 'Lease not found', 404);
  }

  if (lease.tenantId !== tenantId) {
    return errorResponse(res, 'Tenant is not associated with this lease', 400);
  }

  const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;
  if (lease.property.ownerId !== allowedOwnerId) {
    return errorResponse(res, 'You can only create payments for your properties', 403);
  }

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      leaseId,
      amount: parseFloat(amount),
      dueDate: new Date(dueDate),
      notes,
    },
  });

  return successResponse(res, payment, 'Payment created successfully', 201);
});

export const updatePayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, dueDate, notes } = req.body;

    const payment = await prisma.payment.findUnique({
        where: { id },
        include: { lease: { select: { property: { select: { ownerId: true } } } } }
    });

    if (!payment) {
        return errorResponse(res, 'Payment not found', 404);
    }
    
    const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager?.ownerId;
    if (payment.lease.property.ownerId !== allowedOwnerId) {
        return errorResponse(res, 'You are not authorized to update this payment', 403);
    }

    if (payment.status !== 'PENDING') {
        return errorResponse(res, `Cannot update payment with status '${payment.status}'`, 400);
    }

    const updatedPayment = await prisma.payment.update({
        where: { id },
        data: {
            amount: amount ? parseFloat(amount) : undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            notes,
        },
    });

    return successResponse(res, updatedPayment, 'Payment updated successfully');
});

export const deletePayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const payment = await prisma.payment.findUnique({
        where: { id },
        include: { lease: { select: { property: { select: { ownerId: true } } } } }
    });

    if (!payment) {
        return errorResponse(res, 'Payment not found', 404);
    }

    const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager?.ownerId;
    if (payment.lease.property.ownerId !== allowedOwnerId) {
        return errorResponse(res, 'You are not authorized to delete this payment', 403);
    }

    if (payment.status === 'PAID') {
        return errorResponse(res, 'Cannot delete a completed payment', 400);
    }

    await prisma.payment.delete({ where: { id } });

    return successResponse(res, null, 'Payment deleted successfully');
});

export const processOnlinePayment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { paymentMethodToken } = req.body; 

    if (!paymentMethodToken) {
        return errorResponse(res, 'Payment method token is required.', 400);
    }
    
    const payment = await prisma.payment.findUnique({
        where: { id },
        include: { tenant: { include: { user: true } }, lease: { include: { property: { include: { owner: true } } } } }
    });

    if (!payment) {
        return errorResponse(res, 'Payment not found', 404);
    }
    if (payment.tenant.userId !== req.user.id) {
         return errorResponse(res, 'You can only pay for your own bills.', 403);
    }
    if (payment.status === 'PAID') {
        return errorResponse(res, 'This payment has already been paid.', 400);
    }

    const transactionId = `txn_${new Date().getTime()}`;
    logger.info(`Simulating payment for payment ID ${id} with token ${paymentMethodToken}`);
    
    const updatedPayment = await prisma.payment.update({
        where: { id },
        data: {
            status: 'PAID',
            method: 'ONLINE',
            paidDate: new Date(),
            transactionId,
        },
    });

    try {
        const receiptBuffer = await generatePdf({
            payment: updatedPayment,
            tenant: payment.tenant,
            property: payment.lease.property,
            owner: payment.lease.property.owner
        });
        const uploadResult = await uploadToCloudinary(receiptBuffer, 'receipts', { resource_type: 'raw', format: 'pdf' });
        await prisma.receipt.create({
            data: {
                paymentId: updatedPayment.id,
                pdfUrl: uploadResult.secure_url,
                amount: updatedPayment.amount,
            },
        });
        await sendPaymentConfirmationEmail(payment.tenant.user.email, `${payment.tenant.firstName} ${payment.tenant.lastName}`, updatedPayment.amount, uploadResult.secure_url);
    } catch (error) {
        logger.error(`Failed to generate receipt for payment ${id}:`, error);
    }

    return successResponse(res, updatedPayment, 'Payment processed successfully.');
});

export const downloadPaymentReceipt = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
        where: { id },
        include: { tenant: { include: { user: true } }, lease: { include: { property: { include: { owner: true } } } } }
    });
    
    if (!payment) {
        return errorResponse(res, 'Payment not found', 404);
    }
    if (payment.status !== 'PAID') {
        return errorResponse(res, 'Receipt is only available for paid payments', 400);
    }

    const isOwnerOrManager = (req.user.role === 'OWNER' && payment.lease.property.ownerId === req.user.owner.id) ||
                            (req.user.role === 'MANAGER' && payment.lease.property.ownerId === req.user.manager.ownerId);
    const isTenant = req.user.role === 'TENANT' && payment.tenantId === req.user.tenant.id;

    if (!isOwnerOrManager && !isTenant && req.user.role !== 'SUPER_ADMIN') {
        return errorResponse(res, 'You are not authorized to view this receipt', 403);
    }

    const pdfBuffer = await generatePdf({
        payment,
        tenant: payment.tenant,
        property: payment.lease.property,
        owner: payment.lease.property.owner
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment.id}.pdf`);
    res.send(pdfBuffer);
});

export const getPaymentAnalytics = asyncHandler(async (req, res) => {
    let where = {};
    if (req.user.role === 'OWNER') {
        where = { lease: { property: { ownerId: req.user.owner.id } } };
    } else if (req.user.role === 'MANAGER') {
        where = { lease: { property: { ownerId: req.user.manager.ownerId } } };
    }

    const payments = await prisma.payment.findMany({ where });

    const totalRevenue = payments
        .filter(p => p.status === 'PAID')
        .reduce((sum, p) => sum + Number(p.amount), 0);
        
    const pendingRevenue = payments
        .filter(p => p.status === 'PENDING' || p.status === 'OVERDUE')
        .reduce((sum, p) => sum + Number(p.amount), 0);

    const statusBreakdown = payments.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
    }, {});
    
    const methodBreakdown = payments.filter(p => p.status === 'PAID' && p.method).reduce((acc, p) => {
        acc[p.method] = (acc[p.method] || 0) + 1;
        return acc;
    }, {});

    const analytics = {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        pendingRevenue: parseFloat(pendingRevenue.toFixed(2)),
        statusBreakdown,
        methodBreakdown,
        totalTransactions: payments.length,
    };
    
    return successResponse(res, analytics, "Payment analytics retrieved successfully.");
});

export const getOverduePayments = asyncHandler(async (req, res) => {
  const where = {
    status: 'PENDING',
    dueDate: { lt: new Date() },
  };

  if (req.user.role === 'OWNER') {
    where.lease = {
      property: { ownerId: req.user.owner.id },
    };
  } else if (req.user.role === 'MANAGER') {
    where.lease = {
      property: { ownerId: req.user.manager.ownerId },
    };
  }

  const overduePayments = await prisma.payment.findMany({
    where,
    include: {
      tenant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
      lease: {
        select: {
          property: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  if (overduePayments.length > 0) {
    const overdueIds = overduePayments.map(p => p.id);
    await prisma.payment.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: 'OVERDUE' },
    });
  }

  return successResponse(res, {
    overduePayments: overduePayments.map(payment => ({
      ...payment,
      status: 'OVERDUE',
      daysOverdue: Math.floor((new Date() - new Date(payment.dueDate)) / (1000 * 60 * 60 * 24)),
    })),
    count: overduePayments.length,
  });
});
