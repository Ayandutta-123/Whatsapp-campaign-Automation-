const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyAdminLogin } = require('../utils/password');
const { getTokenVersion } = require('../middleware/auth');
const { publicError } = require('../utils/security');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ error: 'Server auth not configured' });
    }

    const valid = await verifyAdminLogin(username, password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tv = await getTokenVersion();
    const token = jwt.sign({ user: username, tv }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });
    return res.json({ token, user: username });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: publicError(err, 'Login failed') });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ') || !process.env.JWT_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    const tv = await getTokenVersion();
    if ((decoded.tv || 1) !== tv) {
      return res.status(401).json({ error: 'Session expired' });
    }
    return res.json({ user: decoded.user });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

module.exports = router;
