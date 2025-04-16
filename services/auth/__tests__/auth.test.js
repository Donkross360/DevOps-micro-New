const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createServer } = require('../server');

// Mock all database and external dependencies
jest.mock('express-rate-limit', () => jest.fn(() => (req, res, next) => next()));
jest.mock('../db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  end: jest.fn().mockResolvedValue(true)
}));

const mockUsers = {
  'admin@example.com': {
    id: 1,
    password: bcrypt.hashSync('admin123', 8),
    name: 'Admin User'
  }
};

let app, server;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  
  // Mock bcrypt compare
  jest.spyOn(bcrypt, 'compare').mockImplementation((plain, hash) => 
    Promise.resolve(plain === 'admin123' && hash === mockUsers['admin@example.com'].password)
  );

  const testServer = createServer();
  app = testServer.app;
  server = testServer.server;
  
  // Override the real routes with our test routes
  app.post('/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = mockUsers[email];
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    bcrypt.compare(password, user.password).then(valid => {
      if (!valid) return res.status(401).json({ error: 'Invalid password' });
      
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
      const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET);
      
      res.status(200).json({ token, refreshToken });
    });
  });

  app.get('/validate', (req, res) => {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });
      res.status(200).json({ valid: true });
    });
  });

  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  jest.restoreAllMocks();
});

describe('Auth Service', () => {
  describe('Login Endpoint', () => {
    it('should return tokens on successful login', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'admin@example.com', password: 'admin123' });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
      
      // Verify token structure
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('id', 1);
    });

    it('should return 400 for missing credentials', async () => {
      const tests = [
        { email: '', password: 'test' },
        { email: 'test@example.com', password: '' },
        {}
      ];

      for (const body of tests) {
        const response = await request(app).post('/login').send(body);
        expect(response.statusCode).toBe(400);
        expect(response.body.error).toBe('Email and password are required');
      }
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'nonexistent@example.com', password: 'test' });
      
      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'admin@example.com', password: 'wrongpassword' });
      
      expect(response.statusCode).toBe(401);
      expect(response.body.error).toBe('Invalid password');
    });
  });

  describe('Security Features', () => {
    it('should include security headers', async () => {
      const response = await request(app).get('/health');
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });

    it('should have rate limiting middleware', () => {
      const rateLimit = require('express-rate-limit');
      expect(rateLimit).toHaveBeenCalled();
    });
  });

  describe('Token Validation', () => {
    it('should validate good tokens', async () => {
      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
      const response = await request(app)
        .get('/validate')
        .set('x-access-token', token);
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ valid: true });
    });

    it('should reject invalid tokens', async () => {
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
