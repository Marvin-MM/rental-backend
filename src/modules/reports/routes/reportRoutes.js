
import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  getFinancialReport,
  getOccupancyReport,
  getMaintenanceReport
} from '../controllers/reportController.js';

const router = Router();

/**
 * @swagger
 * /reports/financial:
 *   get:
 *     tags: [Reports]
 *     summary: Generate financial report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: propertyId
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, pdf]
 *           default: json
 *     responses:
 *       200:
 *         description: Financial report generated successfully
 */
router.get('/financial', authenticate, authorize(['OWNER', 'MANAGER', 'SUPER_ADMIN']), getFinancialReport);

/**
 * @swagger
 * /reports/occupancy:
 *   get:
 *     tags: [Reports]
 *     summary: Generate occupancy report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: propertyId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Occupancy report generated successfully
 */
router.get('/occupancy', authenticate, authorize(['OWNER', 'MANAGER', 'SUPER_ADMIN']), getOccupancyReport);

/**
 * @swagger
 * /reports/maintenance:
 *   get:
 *     tags: [Reports]
 *     summary: Generate maintenance report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: propertyId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Maintenance report generated successfully
 */
router.get('/maintenance', authenticate, authorize(['OWNER', 'MANAGER', 'SUPER_ADMIN']), getMaintenanceReport);

export default router;
