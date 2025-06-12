
import express from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  createOwner,
  getOwners,
  getOwnerById,
  updateOwner,
  deleteOwner,
  getOwnerProperties,
  getOwnerAnalytics,
} from '../controllers/ownerController.js';

const router = express.Router();

/**
 * @swagger
 * /owners:
 *   post:
 *     summary: Create a new owner
 *     tags: [Owners]
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
 *               - companyName
 *               - phone
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               companyName:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Owner created successfully
 */
router.post('/', authenticate, authorize(['SUPER_ADMIN']), createOwner);

/**
 * @swagger
 * /owners:
 *   get:
 *     summary: Get all owners
 *     tags: [Owners]
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
 *     responses:
 *       200:
 *         description: List of owners
 */
router.get('/', authenticate, authorize(['SUPER_ADMIN']), getOwners);

/**
 * @swagger
 * /owners/{id}:
 *   get:
 *     summary: Get owner by ID
 *     tags: [Owners]
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
 *         description: Owner details
 */
router.get('/:id', authenticate, getOwnerById);

/**
 * @swagger
 * /owners/{id}:
 *   put:
 *     summary: Update owner
 *     tags: [Owners]
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
 *         description: Owner updated successfully
 */
router.put('/:id', authenticate, updateOwner);

/**
 * @swagger
 * /owners/{id}:
 *   delete:
 *     summary: Delete owner
 *     tags: [Owners]
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
 *         description: Owner deleted successfully
 */
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN']), deleteOwner);

/**
 * @swagger
 * /owners/{id}/properties:
 *   get:
 *     summary: Get owner properties
 *     tags: [Owners]
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
 *         description: List of owner properties
 */
router.get('/:id/properties', authenticate, getOwnerProperties);

/**
 * @swagger
 * /owners/{id}/analytics:
 *   get:
 *     summary: Get owner analytics
 *     tags: [Owners]
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
 *         description: Owner analytics data
 */
router.get('/:id/analytics', authenticate, getOwnerAnalytics);

export default router;
