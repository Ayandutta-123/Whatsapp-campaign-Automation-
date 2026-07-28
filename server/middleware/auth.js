const jwt = require('jsonwebtoken');
const pool = require('../db');

async function getRequireLogin() {
  // Production always requires auth — cannot be disabled via Settings
  if (process.env.NODE_ENV === 'production') return true;
  if (process.env.REQUIRE_LOGIN === 'false') return false;
  try {
    const res = await pool.query(
      "SELECT value FROM settings WHERE key = 'require_login'"
    );
    // Only honor Settings toggle when explicitly allowed for local dev
    if (process.env.ALLOW_DISABLE_LOGIN === 'true') {
      return res.rows[0]?.value !== 'false';
    }
    return true;
  } catch {
    return true;
  }
}

async function getTokenVersion() {
  try {
    const res = await pool.query(
      "SELECT value FROM settings WHERE key = 'jwt_token_version'"
    );
    return parseInt(res.rows[0]?.value || '1', 10) || 1;
  } catch {
    return 1;
  }
}

async function authMiddleware(req, res, next) {
  try {
    const requireLogin = await getRequireLogin();
    if (!requireLogin) {
      req.user = { user: 'guest' };
      return next();
    }
  } catch {
    return res.status(503).json({ error: 'Database unavailable, please retry' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Server auth not configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, secret);
    const currentVersion = await getTokenVersion();
    if ((decoded.tv || 1) !== currentVersion) {
      return res.status(401).json({ error: 'Session expired — please sign in again' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
module.exports.getRequireLogin = getRequireLogin;
module.exports.getTokenVersion = getTokenVersion;
