const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock the database before importing the app
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn().mockResolvedValue({ 
      rows: [{ count: '1' }],
      rowCount: 1
    }),
    end: jest.fn().mockResolvedValue(true)
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock Stripe
jest.mock('stripe', () => {
  const mockCreate = jest.fn().mockResolvedValue({
    id: 'pi_test123',
    client_secret: 'secret_test123',
    amount: 1000,
    currency: 'usd',
    status: 'requires_payment_method'
  });
  
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockCreate,
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test123',
        amount: 1000,
        currency: 'usd',
        status: 'succeeded'
      })
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            amount: 1000,
            currency: 'usd',
            status: 'succeeded'
          }
        }
      })
    }
  }));
});

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
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.WEBHOOK_SECRET = 'whsec_123';
process.env.NODE_ENV = 'test';

// Import the app after mocking dependencies
const app = require('../server');
const pool = require('../db');
const stripe = require('stripe')();

describe('Payment Service', () => {
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

  describe('Create Payment Intent', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/create-payment-intent')
        .send({ amount: 1000, currency: 'usd' });
      
      expect(res.statusCode).toBe(401);
    });

    it('should return 400 with invalid amount', async () => {
      const res = await request(app)
        .post('/create-payment-intent')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ amount: -100, currency: 'usd' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should create a payment intent successfully', async () => {
      const res = await request(app)
        .post('/create-payment-intent')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ amount: 1000, currency: 'usd' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('clientSecret');
      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          currency: 'usd',
          metadata: expect.objectContaining({ userId: 1 })
        })
      );
    });
  });

  describe('Get Payment', () => {
    it('should return payment details', async () => {
      // Setup mock response for the payment query
      pool.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 1, 
          user_id: 1, 
          amount: 1000, 
          currency: 'USD', 
          status: 'completed',
          payment_id: 'pi_test123',
          created_at: new Date().toISOString()
        }],
        rowCount: 1
      });
      
      const res = await request(app)
        .get('/payments/1')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('id', 1);
      expect(res.body).toHaveProperty('amount', 1000);
      expect(res.body).toHaveProperty('status', 'completed');
      
      // Verify the query was called
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM payments WHERE id = $1 AND user_id = $2',
        [1, 1]
      );
    });
    
    it('should return 404 for non-existent payment', async () => {
      // Setup mock to return no rows
      pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      
      const res = await request(app)
        .get('/payments/999')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error', 'Payment not found');
    });
  });

  describe('Webhook Handler', () => {
    it('should process valid webhook events', async () => {
      const mockSignature = 'test_signature';
      
      // Mock the query to be successful
      pool.query.mockResolvedValueOnce({ rowCount: 1 });
      
      const res = await request(app)
        .post('/webhook')
        .set('stripe-signature', mockSignature)
        .send({
          id: 'evt_test123',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test123',
              amount: 1000,
              currency: 'usd',
              status: 'succeeded',
              metadata: { userId: 1 }
            }
          }
        });
      
      expect(res.statusCode).toBe(200);
      expect(pool.query).toHaveBeenCalled();
    });
    
    it('should handle invalid webhook signatures', async () => {
      // Force an error for this test
      stripe.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });
      
      const res = await request(app)
        .post('/webhook')
        .set('stripe-signature', 'invalid_signature')
        .send({ id: 'invalid_event' });
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('List User Payments', () => {
    it('should return user payments', async () => {
      // Setup mock response for the payments query
      pool.query.mockResolvedValueOnce({ 
        rows: [
          { 
            id: 1, 
            user_id: 1, 
            amount: 1000, 
            currency: 'USD', 
            status: 'completed',
            payment_id: 'pi_test123',
            created_at: new Date().toISOString()
          },
          { 
            id: 2, 
            user_id: 1, 
            amount: 2000, 
            currency: 'USD', 
            status: 'completed',
            payment_id: 'pi_test456',
            created_at: new Date().toISOString()
          }
        ]
      });
      
      const res = await request(app)
        .get('/user/payments')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body[0]).toHaveProperty('id', 1);
      expect(res.body[1]).toHaveProperty('id', 2);
      
      // Verify the query was called
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC',
        [1]
      );
    });
  });
});
