const request = require('supertest');
const app = require('../server'); // Assuming server.js exports the app

describe('Payment Service', () => {
  it('should process payment successfully', async () => {
    const response = await request(app)
      .post('/process-payment')
      .send({ amount: 100, currency: 'USD' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('message', 'Payment processed successfully');
  });
});
