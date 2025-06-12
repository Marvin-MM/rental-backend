import { Router } from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { validateComplaint, validateComplaintUpdate } from '../../../middleware/validation.js';
import {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaint,
  deleteComplaint,
  assignComplaint,
  updateComplaintStatus,
} from '../controllers/complaintController.js';

const router = Router();

/**
 * @swagger
 * /complaints:
 *   post:
 *     tags: [Complaints]
 *     summary: Create a new complaint
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
 *               - description
 *               - priority
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *               category:
 *                 type: string
 *                 enum: [MAINTENANCE, NOISE, UTILITIES, SECURITY, OTHER]
 *               propertyId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Complaint created successfully
 */
router.post('/', authenticate, authorize(['TENANT', 'MANAGER', 'OWNER']), validateComplaint, createComplaint);

/**
 * @swagger
 * /complaints:
 *   get:
 *     tags: [Complaints]
 *     summary: Get all complaints
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
 *           enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *     responses:
 *       200:
 *         description: List of complaints
 */
router.get('/', authenticate, authorize(['TENANT', 'MANAGER', 'OWNER', 'SUPER_ADMIN']), getComplaints);

/**
 * @swagger
 * /complaints/{id}:
 *   get:
 *     tags: [Complaints]
 *     summary: Get complaint by ID
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
 *         description: Complaint details
 */
router.get('/:id', authenticate, authorize(['TENANT', 'MANAGER', 'OWNER', 'SUPER_ADMIN']), getComplaintById);

/**
 * @swagger
 * /complaints/{id}:
 *   put:
 *     tags: [Complaints]
 *     summary: Update complaint
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *     responses:
 *       200:
 *         description: Complaint updated successfully
 */
router.put('/:id', authenticate, authorize(['TENANT', 'MANAGER', 'OWNER']), validateComplaintUpdate, updateComplaint);

/**
 * @swagger
 * /complaints/{id}:
 *   delete:
 *     tags: [Complaints]
 *     summary: Delete complaint
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Complaint deleted successfully
 */
router.delete('/:id', authenticate, authorize(['MANAGER', 'OWNER', 'SUPER_ADMIN']), deleteComplaint);

/**
 * @swagger
 * /complaints/{id}/assign:
 *   post:
 *     tags: [Complaints]
 *     summary: Assign complaint to manager
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
 *               - managerId
 *             properties:
 *               managerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Complaint assigned successfully
 */
router.post('/:id/assign', authenticate, authorize(['OWNER', 'SUPER_ADMIN']), assignComplaint);

/**
 * @swagger
 * /complaints/{id}/status:
 *   patch:
 *     tags: [Complaints]
 *     summary: Update complaint status
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *               resolution:
 *                 type: string
 *     responses:
 *       200:
 *         description: Complaint status updated successfully
 */
router.patch('/:id/status', authenticate, authorize(['MANAGER', 'OWNER', 'SUPER_ADMIN']), updateComplaintStatus);

export default router;