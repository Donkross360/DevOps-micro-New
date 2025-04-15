const request = require('supertest');
const app = require('../server'); // Assuming server.js exports the app

describe('Auth Service', () => {
  it('should return a token on successful login', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'admin@example.com', password: 'admin123' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('token');
  });

  it('should return 404 for non-existent user', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'nonexistent@example.com', password: 'wrongpassword' });

    expect(response.statusCode).toBe(404);
  });
});
