const rateLimit = require('express-rate-limit');

/**
 * Authenticated SPA polls notifications/campaign progress frequently.
 * A low global cap (e.g. 500/15m) blocks Settings/dashboard with 429 after
 * normal use — that looked like "Failed to load settings" / empty fields.
 *
 * Keep login/upload strict; keep API roomy; skip high-frequency GET polls.
 */
const API_WINDOW_MS = 15 * 60 * 1000;
const API_MAX = Math.max(
  1000,
  parseInt(process.env.API_RATE_LIMIT || '8000', 10) || 8000
);

function isHighFrequencyPoll(req) {
  const path = (req.path || req.url || '').split('?')[0];
  if (req.method !== 'GET') return false;
  if (path === '/notifications' || path.startsWith('/notifications/')) return true;
  if (/^\/campaigns\/\d+\/progress$/.test(path)) return true;
  if (/^\/campaigns\/\d+\/logs$/.test(path)) return true;
  return false;
}

const apiLimiter = rateLimit({
  windowMs: API_WINDOW_MS,
  max: API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => isHighFrequencyPoll(req),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Math.max(5, parseInt(process.env.AUTH_RATE_LIMIT || '30', 10) || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached, try again later' },
});

module.exports = { apiLimiter, authLimiter, uploadLimiter };
