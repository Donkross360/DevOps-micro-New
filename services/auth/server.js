require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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

// Modern user store with email login
const users = new Map([
  ['admin@example.com', {
    id: 1,
    password: bcrypt.hashSync(process.env.DEFAULT_PASSWORD || 'admin123', 8),
    name: 'Admin User'
  }]
]);

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = users.get(email);
  if (!user) return res.status(404).send('User not found');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).send('Invalid credentials');

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
    expiresIn: 86400 // 24 hours
  });

  res.status(200).send({ token });
});

app.get('/validate', (req, res) => {
  const token = req.headers['x-access-token'];
  if (!token) return res.status(403).send('No token provided');

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(500).send('Failed to authenticate token');
    const user = Array.from(users.values()).find(u => u.id === decoded.id);
    res.status(200).send({ 
      valid: true, 
      userId: decoded.id,
      email: decoded.email,
      name: user?.name || ''
    });
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});
