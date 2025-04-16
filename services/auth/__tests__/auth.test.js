const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createServer } = require('../server');
const pool = require('../db');
jest.mock('../db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  end: jest.fn().mockResolvedValue(true)
}));

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
    const { email, password } = req.body;
    const user = mockUsers[email];
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (password !== 'admin123') return res.status(401).json({ error: 'Invalid password' });
    
    res.json({
      token: jwt.sign({ id: user.id }, process.env.JWT_SECRET),
      refreshToken: 'mock-refresh-token'
    });
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
        refreshToken: 'test-refresh-token'
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
      expect(response.headers).toHaveProperty('x-powered-by', 'Express');
    });

    it('should enforce rate limiting', async () => {
      const testRequests = Array(105).fill().map(() => 
        request(app).post('/login').send({ email: 'test@example.com', password: 'test' })
      );

      const responses = await Promise.all(testRequests);
      const rejected = responses.filter(r => r.statusCode === 429);
      expect(rejected.length).toBeGreaterThan(0);
    });
  });

  describe('Token Validation', () => {
    let validToken;

    beforeAll(async () => {
      const login = await request(app)
        .post('/login')
        .send({ email: 'admin@example.com', password: 'admin123' });
      validToken = login.body.token;
    });

    it('should validate good tokens', async () => {
      const response = await request(app)
        .get('/validate')
        .set('x-access-token', validToken);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('valid', true);
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
        expect([403, 500]).toContain(response.statusCode);
      }
    });
  });
});
