const request = require('supertest');
const app = require('../server'); // Assuming server.js exports the app

describe('Backend Service', () => {
  it('should return protected data', async () => {
    const response = await request(app)
      .get('/api/data')
      .set('x-access-token', 'valid_token');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('message', 'Protected data');
  });

  it('should return 403 for invalid token', async () => {
    const response = await request(app)
      .get('/api/data')
      .set('x-access-token', 'invalid_token');

    expect(response.statusCode).toBe(403);
  });
});
