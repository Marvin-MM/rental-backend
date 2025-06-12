
import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { validateUser, validateUserUpdate, validateSystemSetting } from '../../../middleware/validation.js';
import {
  getDashboardStats,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getSystemSettings,
  updateSystemSetting,
  getAuditLogs,
} from '../controllers/adminController.js';

const router = Router();

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Get dashboard statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/dashboard', authenticate, authorize(['SUPER_ADMIN']), getDashboardStats);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Get all users
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [SUPER_ADMIN, OWNER, MANAGER, TENANT]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', authenticate, authorize(['SUPER_ADMIN']), getAllUsers);

/**
 * @swagger
 * /admin/users:
 *   post:
 *     tags: [Admin]
 *     summary: Create a new user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [OWNER, MANAGER, TENANT]
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 */
router.post('/users', authenticate, authorize(['SUPER_ADMIN']), validateUser, createUser);

/**
 * @swagger
 * /admin/users/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Update user
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
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 */
router.put('/users/:id', authenticate, authorize(['SUPER_ADMIN']), validateUserUpdate, updateUser);

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete user
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
 *         description: User deleted successfully
 */
router.delete('/users/:id', authenticate, authorize(['SUPER_ADMIN']), deleteUser);

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     tags: [Admin]
 *     summary: Get system settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System settings
 */
router.get('/settings', authenticate, authorize(['SUPER_ADMIN']), getSystemSettings);

/**
 * @swagger
 * /admin/settings/{key}:
 *   put:
 *     tags: [Admin]
 *     summary: Update system setting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
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
 *               - value
 *             properties:
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Setting updated successfully
 */
router.put('/settings/:key', authenticate, authorize(['SUPER_ADMIN']), validateSystemSetting, updateSystemSetting);

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Get audit logs
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
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Audit logs
 */
router.get('/audit-logs', authenticate, authorize(['SUPER_ADMIN']), getAuditLogs);

export default router;
