import express from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  createPayment,
  getPayments,
  getPaymentById,
  // updatePayment,
  // deletePayment,
  // processPayment,
  getOverduePayments,
  // generatePaymentReceipt,
  // getPaymentAnalytics,
} from '../controllers/paymentController.js';

const router = express.Router();

/**
 * @swagger
 * /payments:
 *   post:
 *     summary: Create a new payment
 *     tags: [Payments]
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
 *               - amount
 *               - dueDate
 *               - type
 *             properties:
 *               tenantId:
 *                 type: string
 *               amount:
 *                 type: number
 *               dueDate:
 *                 type: string
 *                 format: date
 *               type:
 *                 type: string
 *                 enum: [RENT, DEPOSIT, UTILITIES, MAINTENANCE, LATE_FEE]
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), createPayment);

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Payments]
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
 *           enum: [PENDING, PAID, OVERDUE, CANCELLED]
 *     responses:
 *       200:
 *         description: List of payments
 */
router.get('/', authenticate, getPayments);

/**
 * @swagger
 * /payments/overdue:
 *   get:
 *     summary: Get overdue payments
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of overdue payments
 */
router.get('/overdue', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), getOverduePayments);

/**
 * @swagger
 * /payments/analytics:
 *   get:
 *     summary: Get payment analytics
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment analytics data
 */
router.get('/analytics', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), getPaymentAnalytics);

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
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
 *         description: Payment details
 *       404:
 *         description: Payment not found
 */
router.get('/:id', authenticate, getPaymentById);

/**
 * @swagger
 * /payments/{id}:
 *   put:
 *     summary: Update payment
 *     tags: [Payments]
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
 *         description: Payment updated successfully
 */
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), updatePayment);

/**
 * @swagger
 * /payments/{id}:
 *   delete:
 *     summary: Delete payment
 *     tags: [Payments]
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
 *         description: Payment deleted successfully
 */
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), deletePayment);

/**
 * @swagger
 * /payments/{id}/process:
 *   post:
 *     summary: Process payment
 *     tags: [Payments]
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
 *         description: Payment processed successfully
 */
router.post('/:id/process', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), processPayment);

/**
 * @swagger
 * /payments/{id}/receipt:
 *   get:
 *     summary: Generate payment receipt
 *     tags: [Payments]
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
 *         description: Payment receipt PDF
 */
router.get('/:id/receipt', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), generatePaymentReceipt);

export default router;