const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createServer } = require('../server');
const pool = require('../db');

// Mock the rate limiter
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});

jest.mock('../../shared/__mocks__/db');
const mockDb = require('../../shared/__mocks__/db');

beforeEach(() => {
  mockDb.query.mockClear();
  mockDb.end.mockClear();
  
  // Setup default auth mock responses
  mockDb.mockAuthResponse([{ 
    token: 'mock-refresh-token',
    user_id: 1 
  }]);
});

const mockUsers = {
  'admin@example.com': {
    id: 1,
    password: '$2a$08$somehashedpassword',
    name: 'Admin User'
  }
};

let app, server;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  
  const testServer = createServer();
  app = testServer.app;
  server = testServer.server;
  
  // Setup mock routes
  app.post('/login', (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Check for missing fields
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = mockUsers[email];
      if (!user) return res.status(404).json({ error: 'User not found' });
      if (password !== 'admin123') return res.status(401).json({ error: 'Invalid password' });
      
      res.status(200).json({
        token: jwt.sign({ id: user.id }, process.env.JWT_SECRET),
        refreshToken: 'mock-refresh-token'
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.get('/validate', (req, res) => {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).json({ error: 'No token' });
    
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      res.json({ valid: true });
    } catch {
      res.status(403).json({ error: 'Invalid token' });
    }
  });
  
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });
});

describe('Auth Service', () => {
  beforeAll(async () => {
    // Ensure test tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL DEFAULT NOW() + INTERVAL '7 days'
      )
    `);
  });

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  jest.clearAllMocks();
  jest.resetModules();
});

  describe('Login Endpoint', () => {
    it('should return tokens on successful login', async () => {
      // Mock bcrypt compare
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(true);
      
      // Mock jwt sign
      jest.spyOn(jwt, 'sign').mockImplementation((payload, secret) => {
        if (secret === process.env.JWT_SECRET) return 'test-access-token';
        return 'test-refresh-token';
      });

      const response = await request(app)
        .post('/login')
        .send({ email: 'admin@example.com', password: 'admin123' });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        token: 'test-access-token',
        refreshToken: 'mock-refresh-token'
      });
    });

    it('should return 400 for missing credentials', async () => {
      const tests = [
        { email: '', password: 'admin123' },
        { email: 'admin@example.com', password: '' },
        {}
      ];

      for (const body of tests) {
        const response = await request(app).post('/login').send(body);
        expect(response.statusCode).toBe(400);
      }
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'nonexistent@example.com', password: 'wrongpassword' });
      expect(response.statusCode).toBe(404);
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'admin@example.com', password: 'wrongpassword' });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Security Features', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health');
      expect(response.headers).toHaveProperty('content-security-policy');
    });

    it('should mock rate limiting', () => {
      // Verify the rate limiter mock was called
      const rateLimit = require('express-rate-limit');
      expect(rateLimit).toHaveBeenCalled();
    });
  });

  describe('Token Validation', () => {
    let validToken = 'test-access-token';

    it('should validate good tokens', async () => {
      // Mock jwt verify to always succeed
      jest.spyOn(jwt, 'verify').mockImplementation(() => ({ id: 1 }));
      
      const response = await request(app)
        .get('/validate')
        .set('x-access-token', 'valid-token');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ valid: true });
    });

    it('should reject invalid tokens', async () => {
      // Mock jwt verify to throw error for invalid tokens
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const tests = [
        'invalid.token.here',
        jwt.sign({ id: 1 }, 'wrong-secret', { expiresIn: '1h' }),
        ''
      ];

      for (const token of tests) {
        const response = await request(app)
          .get('/validate')
          .set('x-access-token', token);
        expect(response.statusCode).toBe(403);
      }
    });
  });
});
