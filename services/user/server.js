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

app.get('/users', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
});
