
import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/config/database.js';
import { generateToken } from '../src/utils/helpers.js';

describe('Authentication', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test' } }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        role: 'TENANT'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should fail with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'Password123!',
        role: 'TENANT'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        role: 'TENANT'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'login-test@example.com',
          password: 'Password123!',
          role: 'TENANT'
        });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'Password123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });

    it('should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
