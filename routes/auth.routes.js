const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const HttpError = require('../utils/httpError');

const router = express.Router();

// POST /api/auth/login  { role: 'admin'|'user', username, password }
router.post('/login', async (req, res) => {
  const { role, username, password } = req.body;
  if (!role || !username || !password) throw new HttpError(400, 'role, username and password are required');

  if (role === 'admin') {
    if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
      throw new HttpError(401, 'Invalid admin credentials');
    }
    const token = jwt.sign({ role: 'admin', username }, process.env.JWT_SECRET, { expiresIn: '365d' });
    return res.json({ token, role: 'admin', name: 'Administrator' });
  }

  if (role === 'user') {
    const user = User.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, 'Invalid username or password');
    }
    const token = jwt.sign({ role: 'user', userId: user.id }, process.env.JWT_SECRET, { expiresIn: '365d' });
    return res.json({ token, role: 'user', name: user.name, userId: user.id });
  }

  throw new HttpError(400, 'role must be "admin" or "user"');
});

module.exports = router;
