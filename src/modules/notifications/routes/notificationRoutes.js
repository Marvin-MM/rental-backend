
import express from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  sendBulkNotification,
  getNotificationSettings,
  updateNotificationSettings,
} from '../controllers/notificationController.js';

const router = express.Router();

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
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
 *           default: 20
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get('/', authenticate, getNotifications);

/**
 * @swagger
 * /notifications/bulk:
 *   post:
 *     summary: Send bulk notification
 *     tags: [Notifications]
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
 *               - message
 *               - recipients
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *               type:
 *                 type: string
 *                 enum: [EMAIL, PUSH, IN_APP]
 *     responses:
 *       200:
 *         description: Bulk notification sent successfully
 */
router.post('/bulk', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), sendBulkNotification);

/**
 * @swagger
 * /notifications/settings:
 *   get:
 *     summary: Get notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User notification settings
 */
router.get('/settings', authenticate, getNotificationSettings);

/**
 * @swagger
 * /notifications/settings:
 *   put:
 *     summary: Update notification settings
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailNotifications:
 *                 type: boolean
 *               pushNotifications:
 *                 type: boolean
 *               smsNotifications:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.put('/settings', authenticate, updateNotificationSettings);

/**
 * @swagger
 * /notifications/mark-all-read:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.post('/mark-all-read', authenticate, markAllAsRead);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
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
 *         description: Notification marked as read
 */
router.patch('/:id/read', authenticate, markAsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete notification
 *     tags: [Notifications]
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
 *         description: Notification deleted successfully
 */
router.delete('/:id', authenticate, deleteNotification);

export default router;
