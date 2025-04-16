require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: 'db',
  database: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

// Middleware to verify JWT
// Minimal but secure token verification
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.sendStatus(403);
    req.user = decoded;
    next();
  });
};

const bcrypt = require('bcryptjs');

app.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/users', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/profile', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

function createServer() {
  const app = express();
  const server = app.listen(process.env.PORT || 0);
  
  // Middleware
  app.use(express.json());
  app.use(cors());

  // Routes
  app.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Check if user exists
      const existingUser = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const result = await pool.query(
        'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
        [email, hashedPassword, name]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.get('/users', verifyToken, async (req, res) => {
    try {
      const result = await pool.query('SELECT id, email, name FROM users');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/profile', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, email, name FROM users WHERE id = $1',
        [req.user.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Verify DB connection on startup
  pool.query('SELECT 1')
    .then(() => console.log('Database connected'))
    .catch(err => console.error('Database connection error', err));

  return { app, server };
}

const PORT = process.env.PORT || 6000;
const { app, server } = createServer();

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`User service running on port ${PORT}`);
  });
}

module.exports = { createServer, app, server };
