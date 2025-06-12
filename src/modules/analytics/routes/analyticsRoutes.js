
import express from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  getDashboardStats,
  getRevenueAnalytics,
  getOccupancyAnalytics,
  getTenantAnalytics,
  getPropertyAnalytics,
  getComplaintAnalytics,
  getPaymentAnalytics,
  exportAnalyticsReport,
} from '../controllers/analyticsController.js';

const router = express.Router();

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/dashboard', authenticate, getDashboardStats);

/**
 * @swagger
 * /analytics/revenue:
 *   get:
 *     summary: Get revenue analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Revenue analytics data
 */
router.get('/revenue', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), getRevenueAnalytics);

/**
 * @swagger
 * /analytics/occupancy:
 *   get:
 *     summary: Get occupancy analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Occupancy analytics data
 */
router.get('/occupancy', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), getOccupancyAnalytics);

/**
 * @swagger
 * /analytics/tenants:
 *   get:
 *     summary: Get tenant analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tenant analytics data
 */
router.get('/tenants', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), getTenantAnalytics);

/**
 * @swagger
 * /analytics/properties:
 *   get:
 *     summary: Get property analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Property analytics data
 */
router.get('/properties', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), getPropertyAnalytics);

/**
 * @swagger
 * /analytics/complaints:
 *   get:
 *     summary: Get complaint analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Complaint analytics data
 */
router.get('/complaints', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), getComplaintAnalytics);

/**
 * @swagger
 * /analytics/payments:
 *   get:
 *     summary: Get payment analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment analytics data
 */
router.get('/payments', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), getPaymentAnalytics);

/**
 * @swagger
 * /analytics/export:
 *   get:
 *     summary: Export analytics report
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [revenue, occupancy, tenants, properties]
 *         required: true
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [pdf, csv]
 *           default: pdf
 *     responses:
 *       200:
 *         description: Analytics report file
 */
router.get('/export', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), exportAnalyticsReport);

export default router;
