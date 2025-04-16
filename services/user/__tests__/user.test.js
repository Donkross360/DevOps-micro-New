const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createServer } = require('../server');

// Mock all database and external dependencies
jest.mock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));
jest.mock('../db', () => ({
  query: jest.fn()
    .mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com', name: 'Test User' }] }) // For registration
    .mockResolvedValue({ rows: [] }), // Default
  end: jest.fn().mockResolvedValue(true)
}));

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
process.env.NODE_ENV = 'test';

const app = createServer();
const pool = require('../db');

describe('User Service', () => {
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

  describe('Registration', () => {
    it('should register a new user', async () => {
      // Mock bcrypt
      bcrypt.genSalt = jest.fn().mockResolvedValue('salt');
      bcrypt.hash = jest.fn().mockResolvedValue('hashed_password');
      
      // Mock DB responses
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // First check if user exists
        .mockResolvedValueOnce({ rows: [] }) // Second check (if needed)
        .mockResolvedValueOnce({ 
          rows: [{ id: 1, email: 'test@example.com', name: 'Test User' }] 
        }); // Insert response
      
      const res = await request(app)
        .post('/register')
        .send({ 
          email: 'test@example.com', 
          password: 'password123', 
          name: 'Test User' 
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id', 1);
      expect(res.body).toHaveProperty('email', 'test@example.com');
      expect(res.body).toHaveProperty('name', 'Test User');
      
      // Verify bcrypt was called
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'salt');
      
      // Verify DB queries
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
    
    it('should return 400 for missing credentials', async () => {
      const res = await request(app)
        .post('/register')
        .send({ email: 'test@example.com' }); // Missing password
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email and password are required');
    });
    
    it('should return 409 if user already exists', async () => {
      // Mock DB to return existing user
      pool.query.mockResolvedValue({ 
        rows: [{ id: 1, email: 'existing@example.com' }] 
      });
      
      const res = await request(app)
        .post('/register')
        .send({ 
          email: 'existing@example.com', 
          password: 'password123' 
        });
      
      expect(res.statusCode).toBe(409);
      expect(res.body).toHaveProperty('error', 'User already exists');
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Profile', () => {
    it('should return user profile with valid token', async () => {
      // Mock DB to return user
      pool.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 1, 
          email: 'existing@example.com',  // Match the email from existing user test
          name: 'Test User',
          created_at: new Date().toISOString()
        }] 
      });
      
      const res = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('id', 1);
      expect(res.body).toHaveProperty('email', 'test@example.com');
      expect(res.body).toHaveProperty('name', 'Test User');
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
    
    it('should return 401 without token', async () => {
      const res = await request(app).get('/profile');
      expect(res.statusCode).toBe(401);
    });
    
    it('should return 404 if user not found', async () => {
      // Mock DB to return no user
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Mock token verification to return a user ID that doesn't exist
      jwt.verify.mockImplementation(() => ({ id: 999 }));
      
      const res = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'User not found');
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('Update Profile', () => {
    it('should update user profile', async () => {
      // Mock DB to update user
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // First check user exists
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 1, 
            email: 'existing@example.com', 
            name: 'Updated Name' 
          }] 
        }); // Update response
      
      const res = await request(app)
        .put('/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'Updated Name' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('name', 'Updated Name');
      
      // Verify DB query
      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, email, name',
        ['Updated Name', 1]
      );
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });
});
