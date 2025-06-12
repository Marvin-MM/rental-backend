
import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/config/database.js';

describe('Maintenance Routes', () => {
  let authToken;
  let tenantId;
  let propertyId;

  beforeAll(async () => {
    // Create test user and get auth token
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.data.token;
    tenantId = loginResponse.body.data.user.tenant?.id;

    // Create test property
    const property = await prisma.property.create({
      data: {
        name: 'Test Property',
        address: '123 Test St',
        rent: 1200,
        ownerId: 'test-owner-id',
      },
    });
    propertyId = property.id;
  });

  describe('POST /api/v1/maintenance', () => {
    it('should create a maintenance request', async () => {
      const maintenanceData = {
        title: 'Leaky Faucet',
        description: 'The kitchen faucet is leaking',
        category: 'PLUMBING',
        priority: 'MEDIUM',
        propertyId,
      };

      const response = await request(app)
        .post('/api/v1/maintenance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maintenanceData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(maintenanceData.title);
    });

    it('should return 400 for invalid maintenance request data', async () => {
      const invalidData = {
        title: '',
        description: 'Missing title',
      };

      const response = await request(app)
        .post('/api/v1/maintenance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/maintenance', () => {
    it('should get maintenance requests', async () => {
      const response = await request(app)
        .get('/api/v1/maintenance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.requests)).toBe(true);
    });

    it('should filter maintenance requests by status', async () => {
      const response = await request(app)
        .get('/api/v1/maintenance?status=OPEN')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
