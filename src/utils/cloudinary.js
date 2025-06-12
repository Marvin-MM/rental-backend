
import { v2 as cloudinary } from 'cloudinary';
import logger from '../config/logger.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} folder - Folder name in Cloudinary
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Upload result
 */
export const uploadToCloudinary = (fileBuffer, folder = 'rental-management', options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      resource_type: 'auto',
      folder,
      use_filename: true,
      unique_filename: true,
      ...options,
    };

    cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          logger.info(`File uploaded to Cloudinary: ${result.public_id}`);
          resolve(result);
        }
      }
    ).end(fileBuffer);
  });
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Public ID of the file
 * @param {string} resourceType - Resource type (image, video, raw)
 * @returns {Promise<Object>} - Deletion result
 */
export const deleteFromCloudinary = (publicId, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: resourceType },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary delete error:', error);
          reject(error);
        } else {
          logger.info(`File deleted from Cloudinary: ${publicId}`);
          resolve(result);
        }
      }
    );
  });
};

/**
 * Generate signed URL for secure access
 * @param {string} publicId - Public ID of the file
 * @param {Object} options - Transformation options
 * @returns {string} - Signed URL
 */
export const generateSignedUrl = (publicId, options = {}) => {
  const defaultOptions = {
    sign_url: true,
    expire_at: Math.floor(Date.now() / 1000) + 3600, // Expire in 1 hour
    ...options,
  };

  return cloudinary.url(publicId, defaultOptions);
};

export default cloudinary;
