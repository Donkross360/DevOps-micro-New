const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
jest.mock('../db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ count: '1' }] }),
  end: jest.fn().mockResolvedValue(true)
}));

describe('Backend Service', () => {
  let validToken;
  
  beforeAll(() => {
    // Setup test data
    validToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET || 'test-secret');
  });

  describe('Health Check', () => {
    it('should return 200', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('OK');
    });
  });

  describe('Protected Endpoints', () => {
    it('should return 403 without token', async () => {
      const res = await request(app).get('/api/data');
      expect(res.statusCode).toBe(403);
    });

    it('should return 403 with invalid token', async () => {
      const res = await request(app)
        .get('/api/data')
        .set('x-access-token', 'invalid-token');
      expect(res.statusCode).toBe(403);
    });

    it('should return 200 with valid token', async () => {
      const res = await request(app)
        .get('/api/data')
        .set('x-access-token', validToken);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Database Integration', () => {
    it('should maintain DB connection', async () => {
      const res = await pool.query('SELECT * FROM test_data');
      expect(res.rows.length).toBeGreaterThan(0);
    });
  });
});
