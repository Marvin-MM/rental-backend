
import express from 'express';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { validateProperty, validatePropertyUpdate } from '../../../middleware/validation.js';
import { upload } from '../../../middleware/upload.js';
import {
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  uploadPropertyImages,
  deleteProperty,
} from '../controllers/propertyController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Properties
 *   description: Property management endpoints
 */

// All routes require authentication
router.use(authenticate);

// Get all properties
router.get('/', authorize('SUPER_ADMIN', 'OWNER', 'MANAGER'), getProperties);

// Get property by ID
router.get('/:id', authorize('SUPER_ADMIN', 'OWNER', 'MANAGER', 'TENANT'), getPropertyById);

// Create new property
router.post('/', authorize('SUPER_ADMIN', 'OWNER', 'MANAGER'), validateProperty, createProperty);

// Update property
router.put('/:id', authorize('SUPER_ADMIN', 'OWNER', 'MANAGER'), validatePropertyUpdate, updateProperty);

// Upload property images
router.post('/:id/images', authorize('SUPER_ADMIN', 'OWNER', 'MANAGER'), upload.array('images', 10), uploadPropertyImages);

// Delete property
router.delete('/:id', authorize('SUPER_ADMIN', 'OWNER'), deleteProperty);

export default router;
