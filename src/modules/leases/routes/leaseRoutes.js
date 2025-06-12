
import express from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import {
  createLease,
  getLeases,
  getLeaseById,
  updateLease,
  deleteLease,
  terminateLease,
  renewLease,
  getLeaseDocuments,
} from '../controllers/leaseController.js';

const router = express.Router();

/**
 * @swagger
 * /leases:
 *   post:
 *     summary: Create a new lease
 *     tags: [Leases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Lease created successfully
 */
router.post('/', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), createLease);

/**
 * @swagger
 * /leases:
 *   get:
 *     summary: Get all leases
 *     tags: [Leases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of leases
 */
router.get('/', authenticate, getLeases);

/**
 * @swagger
 * /leases/{id}:
 *   get:
 *     summary: Get lease by ID
 *     tags: [Leases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lease details
 */
router.get('/:id', authenticate, getLeaseById);

/**
 * @swagger
 * /leases/{id}:
 *   put:
 *     summary: Update lease
 *     tags: [Leases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lease updated successfully
 */
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), updateLease);

/**
 * @swagger
 * /leases/{id}:
 *   delete:
 *     summary: Delete lease
 *     tags: [Leases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lease deleted successfully
 */
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), deleteLease);

/**
 * @swagger
 * /leases/{id}/terminate:
 *   post:
 *     summary: Terminate lease
 *     tags: [Leases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lease terminated successfully
 */
router.post('/:id/terminate', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), terminateLease);

/**
 * @swagger
 * /leases/{id}/renew:
 *   post:
 *     summary: Renew lease
 *     tags: [Leases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lease renewed successfully
 */
router.post('/:id/renew', authenticate, authorize(['SUPER_ADMIN', 'OWNER', 'MANAGER']), renewLease);

/**
 * @swagger
 * /leases/{id}/documents:
 *   get:
 *     summary: Get lease documents
 *     tags: [Leases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of lease documents
 */
router.get('/:id/documents', authenticate, getLeaseDocuments);

export default router;
