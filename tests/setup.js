
import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/rental_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';

// Mock external services
jest.mock('../src/modules/notifications/services/emailService.js', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/modules/notifications/services/firebaseService.js', () => ({
  sendPushNotification: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/utils/cloudinary.js', () => ({
  uploadImage: jest.fn().mockResolvedValue({
    public_id: 'test-image',
    secure_url: 'https://test.cloudinary.com/image.jpg'
  }),
  deleteImage: jest.fn().mockResolvedValue(true)
}));

// Global test timeout
jest.setTimeout(30000);
