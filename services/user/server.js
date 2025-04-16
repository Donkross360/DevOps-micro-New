require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const winston = require('winston');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'user-service.log' })
  ]
});

function createServer() {
  const app = express();

  // Add logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Authentication middleware
  const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      logger.error('Token verification failed:', err);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  };

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  // Register endpoint
  app.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      // Validate input
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'User already exists' });
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create user
      const result = await pool.query(
        'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
        [email, hashedPassword, name]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Failed to register user' });
    }
  });

  // Get all users (admin only)
  app.get('/users', verifyToken, async (req, res) => {
    try {
      const result = await pool.query('SELECT id, email, name FROM users');
      res.json(result.rows);
    } catch (err) {
      logger.error('Users fetch error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get user profile
  app.get('/profile', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, email, name, created_at FROM users WHERE id = $1',
        [req.user.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Profile fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  });

  // Update user profile
  app.put('/profile', verifyToken, async (req, res) => {
    try {
      const { name } = req.body;
      
      const result = await pool.query(
        'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, email, name',
        [name, req.user.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update user profile' });
    }
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  return app;
}

// Only start the server if this file is run directly
if (require.main === module) {
  const app = createServer();
  const PORT = process.env.PORT || 6000;
  app.listen(PORT, () => {
    logger.info(`User service running on port ${PORT}`);
    // Verify DB connection on startup
    pool.query('SELECT 1')
      .then(() => logger.info('Database connected'))
      .catch(err => logger.error('Database connection error', err));
  });
}

module.exports = { createServer };
