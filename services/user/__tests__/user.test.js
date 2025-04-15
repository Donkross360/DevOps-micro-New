const request = require('supertest');
const app = require('../server'); // Assuming server.js exports the app

describe('User Service', () => {
  it('should return a list of users', async () => {
    const response = await request(app)
      .get('/users')
      .set('Authorization', `Bearer valid_token`);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should return 401 for unauthorized access', async () => {
    const response = await request(app)
      .get('/users');

    expect(response.statusCode).toBe(401);
  });
});
