
import { asyncHandler } from '../../../middleware/errorHandler.js';
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { generatePaymentReceipt } from '../../../utils/pdfGenerator.js';
import { sendPaymentConfirmationEmail, sendPaymentReminderEmail } from '../../notifications/services/emailService.js';
import { uploadToCloudinary } from '../../../utils/cloudinary.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         amount:
 *           type: number
 *         dueDate:
 *           type: string
 *           format: date
 *         paidDate:
 *           type: string
 *           format: date
 *         status:
 *           type: string
 *           enum: [PENDING, PAID, OVERDUE, CANCELLED, REFUNDED]
 *         method:
 *           type: string
 *           enum: [ONLINE, CASH, CHECK, BANK_TRANSFER]
 *         transactionId:
 *           type: string
 *         notes:
 *           type: string
 */

/**
 * @swagger
 * /payments:
 *   get:
 *     tags: [Payments]
 *     summary: Get all payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PAID, OVERDUE, CANCELLED, REFUNDED]
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *       - in: query
 *         name: propertyId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payments retrieved successfully
 */
export const getPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, tenantId, propertyId, startDate, endDate } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  // Role-based filtering
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

  // Date range filter
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

  res.json({
    payments,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment retrieved successfully
 *       404:
 *         description: Payment not found
 */
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
    return res.status(404).json({
      error: 'Payment not found',
      message: 'Payment with this ID does not exist',
    });
  }

  // Check access permissions
  if (req.user.role === 'TENANT' && payment.tenantId !== req.user.tenant.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own payments',
    });
  }

  if (req.user.role === 'OWNER' && payment.lease.property.ownerId !== req.user.owner.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access payments for your properties',
    });
  }

  if (req.user.role === 'MANAGER' && payment.lease.property.ownerId !== req.user.manager.ownerId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access payments for properties you manage',
    });
  }

  res.json({ payment });
});

/**
 * @swagger
 * /payments:
 *   post:
 *     tags: [Payments]
 *     summary: Create a new payment record
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenantId
 *               - leaseId
 *               - amount
 *               - dueDate
 *             properties:
 *               tenantId:
 *                 type: string
 *               leaseId:
 *                 type: string
 *               amount:
 *                 type: number
 *               dueDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment created successfully
 */
export const createPayment = asyncHandler(async (req, res) => {
  const { tenantId, leaseId, amount, dueDate, notes } = req.body;

  // Verify lease and tenant relationship
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      tenant: true,
      property: true,
    },
  });

  if (!lease) {
    return res.status(404).json({
      error: 'Lease not found',
      message: 'Lease with this ID does not exist',
    });
  }

  if (lease.tenantId !== tenantId) {
    return res.status(400).json({
      error: 'Invalid tenant',
      message: 'Tenant is not associated with this lease',
    });
  }

  // Check permissions
  const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;
  if (lease.property.ownerId !== allowedOwnerId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only create payments for your properties',
    });
  }

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      leaseId,
      amount: parseFloat(amount),
      dueDate: new Date(dueDate),
      notes,
    },
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
            select: {
              name: true,
              address: true,
            },
          },
        },
      },
    },
  });

  // Send payment reminder email
  try {
    await sendPaymentReminderEmail(
      payment.tenant.user.email,
      `${payment.tenant.firstName} ${payment.tenant.lastName}`,
      payment.amount,
      payment.dueDate
    );
  } catch (error) {
    logger.error('Failed to send payment reminder email:', error);
  }

  logger.info(`Payment created: ${payment.id} for tenant ${payment.tenant.firstName} ${payment.tenant.lastName}`);

  res.status(201).json({
    message: 'Payment created successfully',
    payment,
  });
});

/**
 * @swagger
 * /payments/{id}/pay:
 *   post:
 *     tags: [Payments]
 *     summary: Mark payment as paid
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - method
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [ONLINE, CASH, CHECK, BANK_TRANSFER]
 *               transactionId:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment marked as paid successfully
 */
export const markPaymentAsPaid = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { method, transactionId, notes } = req.body;

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
                },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return res.status(404).json({
      error: 'Payment not found',
      message: 'Payment with this ID does not exist',
    });
  }

  if (payment.status === 'PAID') {
    return res.status(400).json({
      error: 'Payment already paid',
      message: 'This payment has already been marked as paid',
    });
  }

  // Check permissions
  const allowedOwnerId = req.user.role === 'OWNER' ? req.user.owner.id : req.user.manager.ownerId;
  if (payment.lease.property.ownerId !== allowedOwnerId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only update payments for your properties',
    });
  }

  // Update payment status
  const updatedPayment = await prisma.payment.update({
    where: { id },
    data: {
      status: 'PAID',
      method,
      transactionId,
      paidDate: new Date(),
      notes: notes || payment.notes,
    },
  });

  // Generate receipt
  try {
    const receiptBuffer = await generatePaymentReceipt({
      payment: updatedPayment,
      tenant: payment.tenant,
      property: payment.lease.property,
      owner: payment.lease.property.owner,
    });

    // Upload receipt to Cloudinary
    const uploadResult = await uploadToCloudinary(receiptBuffer, 'receipts', {
      resource_type: 'raw',
      format: 'pdf',
    });

    // Save receipt record
    await prisma.receipt.create({
      data: {
        paymentId: updatedPayment.id,
        pdfUrl: uploadResult.secure_url,
        amount: updatedPayment.amount,
      },
    });

    // Send confirmation email with receipt
    await sendPaymentConfirmationEmail(
      payment.tenant.user.email,
      `${payment.tenant.firstName} ${payment.tenant.lastName}`,
      updatedPayment.amount,
      uploadResult.secure_url
    );

  } catch (error) {
    logger.error('Failed to generate receipt or send confirmation email:', error);
  }

  logger.info(`Payment marked as paid: ${id} by user ${req.user.email}`);

  res.json({
    message: 'Payment marked as paid successfully',
    payment: updatedPayment,
  });
});

/**
 * @swagger
 * /payments/overdue:
 *   get:
 *     tags: [Payments]
 *     summary: Get overdue payments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overdue payments retrieved successfully
 */
export const getOverduePayments = asyncHandler(async (req, res) => {
  const where = {
    status: 'PENDING',
    dueDate: { lt: new Date() },
  };

  // Role-based filtering
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

  // Update status to OVERDUE
  if (overduePayments.length > 0) {
    const overdueIds = overduePayments.map(p => p.id);
    await prisma.payment.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: 'OVERDUE' },
    });
  }

  res.json({
    overduePayments: overduePayments.map(payment => ({
      ...payment,
      status: 'OVERDUE',
      daysOverdue: Math.floor((new Date() - new Date(payment.dueDate)) / (1000 * 60 * 60 * 24)),
    })),
    count: overduePayments.length,
  });
});

/**
 * @swagger
 * /payments/{id}/receipt:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment receipt
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Receipt retrieved successfully
 *       404:
 *         description: Receipt not found
 */
export const getPaymentReceipt = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      receipts: true,
      tenant: true,
      lease: {
        include: {
          property: true,
        },
      },
    },
  });

  if (!payment) {
    return res.status(404).json({
      error: 'Payment not found',
      message: 'Payment with this ID does not exist',
    });
  }

  if (payment.status !== 'PAID') {
    return res.status(400).json({
      error: 'Payment not paid',
      message: 'Receipt is only available for paid payments',
    });
  }

  // Check access permissions
  if (req.user.role === 'TENANT' && payment.tenantId !== req.user.tenant.id) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You can only access your own receipts',
    });
  }

  if (payment.receipts.length === 0) {
    return res.status(404).json({
      error: 'Receipt not found',
      message: 'No receipt available for this payment',
    });
  }

  const receipt = payment.receipts[0]; // Get the latest receipt

  res.json({
    receipt: {
      id: receipt.id,
      pdfUrl: receipt.pdfUrl,
      amount: receipt.amount,
      generatedAt: receipt.generatedAt,
      payment: {
        id: payment.id,
        amount: payment.amount,
        paidDate: payment.paidDate,
        method: payment.method,
        transactionId: payment.transactionId,
      },
    },
  });
});
