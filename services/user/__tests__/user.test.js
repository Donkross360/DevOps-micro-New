const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createServer } = require('../server');
const pool = require('../db');

// Mock database
jest.mock('../db', () => ({
  query: jest.fn()
    .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com', name: 'Test User' }] ) // For registration
    .mockResolvedValue({ rows: [] }), // Default
  end: jest.fn().mockResolvedValue(true)
}));

describe('User Service', () => {
  let app, server;
  let validToken;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    const { app: expressApp, server: httpServer } = createServer();
    app = expressApp;
    server = httpServer;
    validToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    jest.clearAllMocks();
  });

  describe('Registration', () => {
    it('should create new user with hashed password', async () => {
      // Mock bcrypt hash
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password');
      
      const response = await request(app)
        .post('/register')
        .send({
          email: 'test@example.com',
          password: 'test123',
          name: 'Test User'
        });

      expect(response.statusCode).toBe(201);
      expect(response.body).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User'
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('test123', 10);
    });

    it('should return 400 for missing fields', async () => {
      const tests = [
        { email: '', password: 'test123', name: 'Test' },
        { email: 'test@example.com', password: '', name: 'Test' },
        { email: 'test@example.com', password: 'test123', name: '' }
      ];

      for (const body of tests) {
        const response = await request(app).post('/register').send(body);
        expect(response.statusCode).toBe(400);
      }
    });
  });

  describe('User Endpoints', () => {
    it('should return user list for admins', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 for unauthorized access', async () => {
      const response = await request(app).get('/users');
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Profile Endpoint', () => {
    it('should return user profile', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [{ id: 1, email: 'test@example.com', name: 'Test User' }] 
      });

      const response = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User'
      });
    });

    it('should return 404 for non-existent user', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.statusCode).toBe(404);
    });
  });
});
