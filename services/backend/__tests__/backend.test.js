const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database before importing the app
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn().mockResolvedValue({ 
      rows: [{ count: '1' }],
      rowCount: 1
    }),
    end: jest.fn().mockResolvedValue(true)
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock winston logger
jest.mock('winston', () => ({
  format: {
    json: jest.fn(),
    combine: jest.fn(),
    timestamp: jest.fn(),
    printf: jest.fn()
  },
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn()
  }),
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Set environment variables for testing
process.env.JWT_SECRET = 'test-secret';

// Import the app after mocking dependencies
const app = require('../server');
const pool = require('../db');

describe('Backend Service', () => {
  let validToken;
  
  beforeAll(() => {
    // Setup test data
    validToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      expect(res.text).toBe('No token');
    });

    it('should return 403 with invalid token', async () => {
      const res = await request(app)
        .get('/api/data')
        .set('x-access-token', 'invalid-token');
      expect(res.statusCode).toBe(403);
      expect(res.text).toBe('Invalid token');
    });

    it('should return 200 with valid token', async () => {
      const res = await request(app)
        .get('/api/data')
        .set('x-access-token', validToken);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message', 'Protected data');
    });
  });

  describe('Dashboard Endpoint', () => {
    it('should return dashboard data with valid token', async () => {
      // Setup mock responses for the dashboard queries
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })  // userCount
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }); // paymentCount
      
      const res = await request(app)
        .get('/api/dashboard')
        .set('x-access-token', validToken);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('userCount', '5');
      expect(res.body).toHaveProperty('paymentCount', '10');
      expect(res.body).toHaveProperty('message', 'Dashboard data');
      
      // Verify the queries were called
      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query).toHaveBeenCalledWith('SELECT COUNT(*) FROM users');
      expect(pool.query).toHaveBeenCalledWith('SELECT COUNT(*) FROM payments');
    });
    
    it('should handle database errors', async () => {
      // Setup mock to throw an error
      pool.query.mockRejectedValueOnce(new Error('Database error'));
      
      const res = await request(app)
        .get('/api/dashboard')
        .set('x-access-token', validToken);
      
      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error', 'Failed to fetch dashboard data');
    });
  });
});
