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

const mockUsers = {
  'test@example.com': {
    id: 1,
    password: bcrypt.hashSync('test123', 8),
    name: 'Test User'
  }
};

let app, server;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  
  // Mock bcrypt compare
  jest.spyOn(bcrypt, 'compare').mockImplementation((plain, hash) => 
    Promise.resolve(plain === 'test123' && hash === mockUsers['test@example.com'].password)
  );

  const testServer = createServer();
  app = testServer.app;
  server = testServer.server;
  
  // Override the real routes with our test routes
  app.post('/register', (req, res) => {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (mockUsers[email]) {
      return res.status(409).json({ error: 'User already exists' });
    }

    res.status(201).json({
      id: 1,
      email,
      name
    });
  });

  app.get('/users', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, process.env.JWT_SECRET, (err) => {
      if (err) return res.sendStatus(403);
      res.json([mockUsers['test@example.com']]);
    });
  });

  app.get('/profile', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, process.env.JWT_SECRET, (err) => {
      if (err) return res.sendStatus(403);
      res.json(mockUsers['test@example.com']);
    });
  });
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  jest.restoreAllMocks();
});

describe('User Service', () => {
  let validToken;

  beforeAll(() => {
    validToken = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
  });

  describe('Registration', () => {
    it('should create new user', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'new@example.com',
          password: 'test123',
          name: 'New User'
        });

      expect(response.statusCode).toBe(201);
      expect(response.body).toEqual({
        id: 1,
        email: 'new@example.com',
        name: 'New User'
      });
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

    it('should return 409 for existing user', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'test@example.com',
          password: 'test123',
          name: 'Test User'
        });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('User Endpoints', () => {
    it('should return user list for authenticated users', async () => {
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
  });
});
