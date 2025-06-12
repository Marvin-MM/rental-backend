
import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/config/database.js';

describe('Admin Routes', () => {
  let adminAuthToken;
  let testUserId;

  beforeAll(async () => {
    // Create test admin user and get auth token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123',
      });

    adminAuthToken = loginResponse.body.data.token;
  });

  describe('GET /api/v1/admin/dashboard', () => {
    it('should get dashboard statistics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
    });

    it('should return 403 for non-admin users', async () => {
      // Test with regular user token
      const userLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      const userToken = userLoginResponse.body.data.token;

      const response = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/v1/admin/users', () => {
    it('should create a new user', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        role: 'TENANT',
        phone: '1234567890',
      };

      const response = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(userData.email);
      
      testUserId = response.body.data.id;
    });

    it('should return 400 for duplicate email', async () => {
      const userData = {
        email: 'newuser@example.com', // Same email as above
        password: 'password123',
        firstName: 'Another',
        lastName: 'User',
        role: 'TENANT',
      };

      const response = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/admin/users', () => {
    it('should get all users', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.users)).toBe(true);
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users?role=TENANT')
        .set('Authorization', `Bearer ${adminAuthToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  afterAll(async () => {
    // Cleanup test user
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });
});
