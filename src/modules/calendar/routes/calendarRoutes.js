import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  createCalendarEvent,
  getCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../controllers/calendarController.js';

const router = Router();

/**
 * @swagger
 * /calendar/events:
 *   get:
 *     tags: [Calendar]
 *     summary: Get calendar events
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [payment, lease, maintenance]
 *     responses:
 *       200:
 *         description: Calendar events
 */
router.get('/events', authenticate, authorize(['TENANT', 'MANAGER', 'OWNER', 'SUPER_ADMIN']), getCalendarEvents);

/**
 * @swagger
 * /calendar/upcoming:
 *   get:
 *     tags: [Calendar]
 *     summary: Get upcoming events
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *     responses:
 *       200:
 *         description: Upcoming events
 */
router.get('/upcoming', authenticate, authorize(['TENANT', 'MANAGER', 'OWNER', 'SUPER_ADMIN']), getCalendarEvents);

/**
 * @swagger
 * /calendar/events:
 *   post:
 *     tags: [Calendar]
 *     summary: Create calendar event
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - startDate
 *               - endDate
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               type:
 *                 type: string
 *               relatedId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Calendar event created successfully
 */
router.post('/events', authenticate, authorize(['MANAGER', 'OWNER', 'SUPER_ADMIN']), createCalendarEvent);

export default router;