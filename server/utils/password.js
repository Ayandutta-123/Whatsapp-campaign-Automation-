const crypto = require('crypto');
const pool = require('../db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const hashVerify = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashVerify, 'hex'));
  } catch {
    return false;
  }
}

async function ensureAdminCredentials() {
  const usernameRes = await pool.query(
    "SELECT value FROM settings WHERE key = 'admin_username'"
  );
  const passwordRes = await pool.query(
    "SELECT value FROM settings WHERE key = 'admin_password_hash'"
  );

  if (!usernameRes.rows[0]?.value) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('admin_username', $1)
       ON CONFLICT (key) DO NOTHING`,
      [process.env.ADMIN_USERNAME || 'admin']
    );
  }

  if (!passwordRes.rows[0]?.value && process.env.ADMIN_PASSWORD) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('admin_password_hash', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [hashPassword(process.env.ADMIN_PASSWORD)]
    );
  }
}

async function getAdminUsername() {
  const res = await pool.query("SELECT value FROM settings WHERE key = 'admin_username'");
  return res.rows[0]?.value || process.env.ADMIN_USERNAME || 'admin';
}

function safeEqualString(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) {
    // constant-ish work then fail
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

async function verifyAdminLogin(username, password) {
  await ensureAdminCredentials();
  const expectedUser = await getAdminUsername();
  const userOk = safeEqualString(username, expectedUser);

  const res = await pool.query(
    "SELECT value FROM settings WHERE key = 'admin_password_hash'"
  );
  const hash = res.rows[0]?.value;

  if (hash) {
    const passOk = verifyPassword(password, hash);
    return userOk && passOk;
  }

  // First-boot env fallback only when hash is missing
  return userOk && safeEqualString(password, process.env.ADMIN_PASSWORD || '');
}

async function changeAdminPassword(currentPassword, newPassword) {
  const username = await getAdminUsername();
  const valid = await verifyAdminLogin(username, currentPassword);
  if (!valid) {
    throw new Error('Current password is incorrect');
  }
  if (!newPassword || newPassword.length < 10) {
    throw new Error('New password must be at least 10 characters');
  }

  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('admin_password_hash', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [hashPassword(newPassword)]
  );
}

module.exports = {
  hashPassword,
  verifyPassword,
  ensureAdminCredentials,
  getAdminUsername,
  verifyAdminLogin,
  changeAdminPassword,
};
