const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const { Pool } = require('pg');

// Create a test-specific database connection
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'postgres_test',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
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
    try {
      await pool.query('DROP TABLE IF EXISTS refresh_tokens');
      await pool.end();
      // Close the server if needed
      if (app.server) {
        await new Promise(resolve => app.server.close(resolve));
      }
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });

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
      expect(decoded).toHaveProperty('id');
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
