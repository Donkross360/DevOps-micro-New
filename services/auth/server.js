require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: 'db',
  database: 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

// Modern user store with email login
const users = new Map([
  ['admin@example.com', {
    id: 1,
    password: bcrypt.hashSync(process.env.DEFAULT_PASSWORD || 'admin123', 8),
    name: 'Admin User'
  }]
]);

app.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = users.get(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '15m' // Short-lived access token
    });
    
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '7d'
    });

    // Store refresh token in database
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)',
      [user.id, refreshToken]
    );

    res.status(200).send({ token, refreshToken });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add health check endpoint for testing
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/validate', (req, res) => {
  const token = req.headers['x-access-token'];
  if (!token) return res.status(403).json({ error: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    
    const user = Array.from(users.values()).find(u => u.id === decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.status(200).json({ 
      valid: true, 
      userId: decoded.id,
      email: Object.keys(users).find(k => users[k].id === decoded.id),
      name: user.name
    });
  });
});

let server;

function createServer() {
  const newApp = express();
  const newServer = newApp.listen(0); // Random available port
  
  // Apply all middleware and routes to newApp
  newApp.use(helmet());
  newApp.use(cors());
  newApp.use(express.json());
  newApp.use(limiter);
  
  // ... copy all route handlers to newApp ...
  
  return { app: newApp, server: newServer };
}

if (process.env.NODE_ENV !== 'test') {
  const { app, server } = createServer();
  server.listen(process.env.PORT || 4000, () => {
    console.log(`Auth service running on port ${process.env.PORT || 4000}`);
  });
}

module.exports = { 
  createServer 
};
