require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const pool = require('./db');

const winston = require('winston');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

function createApp() {
  const app = express();

  // Add logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  app.use(express.json());
  app.use(cors());

  // Basic token verification
  const verifyToken = (req, res, next) => {
    const token = req.headers['x-access-token'];
    if (!token) return res.status(403).send('No token');
    
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      next();
    } catch {
      res.status(403).send('Invalid token');
    }
  };

  // Single protected endpoint
  app.get('/api/data', verifyToken, (req, res) => {
    res.json({ message: 'Protected data' });
  });

  // Dashboard endpoint
  app.get('/api/dashboard', verifyToken, async (req, res) => {
    try {
      // Example: Fetch some aggregated data
      const userCount = await pool.query('SELECT COUNT(*) FROM users');
      const paymentCount = await pool.query('SELECT COUNT(*) FROM payments');
      
      res.json({
        userCount: userCount.rows[0].count,
        paymentCount: paymentCount.rows[0].count,
        message: 'Dashboard data'
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  // Payment endpoints - proxy to payment service
  app.post('/api/payments/create-intent', verifyToken, async (req, res) => {
    try {
      const { amount, currency } = req.body;
      
      // Forward the request to the payment service
      const response = await fetch(`${process.env.PAYMENT_SERVICE_URL || 'http://payment:7000'}/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${req.headers['x-access-token']}`
        },
        body: JSON.stringify({ amount, currency })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error) {
      logger.error('Payment proxy error:', error);
      res.status(500).json({ error: 'Failed to process payment request' });
    }
  });

  app.get('/api/payments/:id', verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Forward the request to the payment service
      const response = await fetch(`${process.env.PAYMENT_SERVICE_URL || 'http://payment:7000'}/payments/${id}`, {
        headers: {
          'Authorization': `Bearer ${req.headers['x-access-token']}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error) {
      logger.error('Payment fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch payment details' });
    }
  });

  app.get('/api/payments', verifyToken, async (req, res) => {
    try {
      // Forward the request to the payment service
      const response = await fetch(`${process.env.PAYMENT_SERVICE_URL || 'http://payment:7000'}/user/payments`, {
        headers: {
          'Authorization': `Bearer ${req.headers['x-access-token']}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error) {
      logger.error('Payments fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch user payments' });
    }
  });

  // Webhook endpoint - proxy to payment service
  app.post('/api/payments/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    try {
      // Forward the webhook to the payment service
      const response = await fetch(`${process.env.PAYMENT_SERVICE_URL || 'http://payment:7000'}/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': req.headers['stripe-signature']
        },
        body: req.body
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error) {
      logger.error('Webhook proxy error:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });

  return app;
}

// Only start the server if this file is run directly
if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Backend service running on port ${PORT}`);
    // Verify DB connection on startup
    pool.query('SELECT 1')
      .then(() => console.log('Database connected'))
      .catch(err => console.error('Database connection error', err));
  });
}

module.exports = createApp();
