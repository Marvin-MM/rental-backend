
import express from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { validateTenant, validateTenantUpdate } from '../../../middleware/validation.js';
import {
  getTenants,
  getTenantById,
  addTenant,
  updateTenant,
  deactivateTenant,
  getTenantProfile,
} from '../controllers/tenantController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Tenants
 *   description: Tenant management endpoints
 */

// All routes require authentication
router.use(authenticate);

// Get current tenant profile
router.get('/me', authorize('TENANT'), getTenantProfile);

// Get all tenants
router.get('/', authorize('SUPER_ADMIN', 'OWNER', 'MANAGER'), getTenants);

// Get tenant by ID
router.get('/:id', getTenantById);

// Add new tenant
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'MANAGER'), validateTenant, addTenant);

// Update tenant
router.put('/:id', validateTenantUpdate, updateTenant);

// Deactivate tenant
router.patch('/:id/deactivate', authorize('SUPER_ADMIN', 'OWNER', 'MANAGER'), deactivateTenant);

export default router;
