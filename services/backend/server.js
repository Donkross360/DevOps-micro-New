require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
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
