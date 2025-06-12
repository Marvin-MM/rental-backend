
import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { validateMaintenanceRequest, validateMaintenanceUpdate } from '../../../middleware/validation.js';
import {
  createMaintenanceRequest,
  getMaintenanceRequests,
  getMaintenanceRequestById,
  updateMaintenanceRequest,
  assignMaintenanceRequest,
  deleteMaintenanceRequest,
} from '../controllers/maintenanceController.js';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     MaintenanceRequest:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - priority
 *         - category
 *         - propertyId
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         priority:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *         category:
 *           type: string
 *           enum: [PLUMBING, ELECTRICAL, HVAC, APPLIANCE, STRUCTURAL, OTHER]
 *         urgency:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *         status:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, COMPLETED, CANCELLED]
 *         propertyId:
 *           type: string
 *         requestedById:
 *           type: string
 *         assignedToId:
 *           type: string
 *         resolution:
 *           type: string
 */

/**
 * @swagger
 * /maintenance:
 *   post:
 *     tags: [Maintenance]
 *     summary: Create a new maintenance request
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MaintenanceRequest'
 *     responses:
 *       201:
 *         description: Maintenance request created successfully
 */
router.post('/', authenticate, authorize(['TENANT', 'MANAGER', 'OWNER', 'SUPER_ADMIN']), validateMaintenanceRequest, createMaintenanceRequest);

/**
 * @swagger
 * /maintenance:
 *   get:
 *     tags: [Maintenance]
 *     summary: Get all maintenance requests
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
 *           enum: [OPEN, IN_PROGRESS, COMPLETED, CANCELLED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [PLUMBING, ELECTRICAL, HVAC, APPLIANCE, STRUCTURAL, OTHER]
 *     responses:
 *       200:
 *         description: List of maintenance requests
 */
router.get('/', authenticate, authorize(['TENANT', 'MANAGER', 'OWNER', 'SUPER_ADMIN']), getMaintenanceRequests);

/**
 * @swagger
 * /maintenance/{id}:
 *   get:
 *     tags: [Maintenance]
 *     summary: Get maintenance request by ID
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
 *         description: Maintenance request details
 */
router.get('/:id', authenticate, authorize(['TENANT', 'MANAGER', 'OWNER', 'SUPER_ADMIN']), getMaintenanceRequestById);

/**
 * @swagger
 * /maintenance/{id}:
 *   put:
 *     tags: [Maintenance]
 *     summary: Update maintenance request
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
 *             $ref: '#/components/schemas/MaintenanceRequest'
 *     responses:
 *       200:
 *         description: Maintenance request updated successfully
 */
router.put('/:id', authenticate, authorize(['MANAGER', 'OWNER', 'SUPER_ADMIN']), validateMaintenanceUpdate, updateMaintenanceRequest);

/**
 * @swagger
 * /maintenance/{id}/assign:
 *   post:
 *     tags: [Maintenance]
 *     summary: Assign maintenance request to user
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
 *               - assignedToId
 *             properties:
 *               assignedToId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Maintenance request assigned successfully
 */
router.post('/:id/assign', authenticate, authorize(['OWNER', 'SUPER_ADMIN']), assignMaintenanceRequest);

/**
 * @swagger
 * /maintenance/{id}:
 *   delete:
 *     tags: [Maintenance]
 *     summary: Delete maintenance request
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
 *         description: Maintenance request deleted successfully
 */
router.delete('/:id', authenticate, authorize(['OWNER', 'SUPER_ADMIN']), deleteMaintenanceRequest);

export default router;
