
import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { validateManager, validateManagerUpdate } from '../../../middleware/validation.js';
import {
  createManager,
  getManagers,
  getManagerById,
  updateManager,
  deleteManager,
  assignPropertyToManager,
  getManagerProperties,
  removePropertyFromManager,
} from '../controllers/managerController.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Manager:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - email
 *         - phone
 *       properties:
 *         id:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *         phone:
 *           type: string
 *         isActive:
 *           type: boolean
 *         specializations:
 *           type: array
 *           items:
 *             type: string
 */

/**
 * @swagger
 * /managers:
 *   post:
 *     tags: [Managers]
 *     summary: Create a new manager
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Manager'
 *     responses:
 *       201:
 *         description: Manager created successfully
 */
router.post('/',  validateManager, createManager);

/**
 * @swagger
 * /managers:
 *   get:
 *     tags: [Managers]
 *     summary: Get all managers
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
 *         description: List of managers
 */
router.get('/', authenticate, authorize(['OWNER', 'SUPER_ADMIN']), getManagers);

/**
 * @swagger
 * /managers/{id}:
 *   get:
 *     tags: [Managers]
 *     summary: Get manager by ID
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
 *         description: Manager details
 */
router.get('/:id', authenticate, authorize(['MANAGER', 'OWNER', 'SUPER_ADMIN']), getManagerById);

/**
 * @swagger
 * /managers/{id}:
 *   put:
 *     tags: [Managers]
 *     summary: Update manager
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
 *             $ref: '#/components/schemas/Manager'
 *     responses:
 *       200:
 *         description: Manager updated successfully
 */
router.put('/:id', authenticate, authorize(['OWNER', 'SUPER_ADMIN']), validateManagerUpdate, updateManager);

/**
 * @swagger
 * /managers/{id}:
 *   delete:
 *     tags: [Managers]
 *     summary: Delete manager
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
 *         description: Manager deleted successfully
 */
router.delete('/:id', authenticate, authorize(['OWNER', 'SUPER_ADMIN']), deleteManager);

/**
 * @swagger
 * /managers/{id}/properties:
 *   get:
 *     tags: [Managers]
 *     summary: Get properties managed by manager
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
 *         description: List of managed properties
 */
router.get('/:id/properties', authenticate, authorize(['MANAGER', 'OWNER', 'SUPER_ADMIN']), getManagerProperties);

/**
 * @swagger
 * /managers/{id}/properties/{propertyId}:
 *   post:
 *     tags: [Managers]
 *     summary: Assign property to manager
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property assigned successfully
 */
router.post('/:id/properties/:propertyId', authenticate, authorize(['OWNER', 'SUPER_ADMIN']), assignPropertyToManager);

/**
 * @swagger
 * /managers/{id}/properties/{propertyId}:
 *   delete:
 *     tags: [Managers]
 *     summary: Unassign property from manager
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property unassigned successfully
 */
router.delete('/:id/properties/:propertyId', authenticate, authorize(['OWNER', 'SUPER_ADMIN']), removePropertyFromManager);

export default router;
