const crypto = require('crypto');
const path = require('path');

const WEAK_JWT_SECRETS = new Set([
  '',
  'secret',
  'changeme',
  'change_this_to_a_long_random_string',
  'hyperthink_jwt_2025',
  'jwt_secret',
]);

const BLOCKED_SETTING_KEYS = new Set([
  'admin_password_hash',
  'admin_username',
  'jwt_token_version',
]);

const ALLOWED_SETTING_KEYS = new Set([
  'whatsapp_token',
  'phone_number_id',
  'waba_id',
  'meta_app_id',
  'meta_app_secret',
  'public_base_url',
  'webhook_verify_token',
  'business_name',
  'send_delay_ms',
  'daily_send_limit',
  'anthropic_api_key',
]);

function assertSecureEnv() {
  const secret = process.env.JWT_SECRET || '';
  const isProd = process.env.NODE_ENV === 'production';

  if (!secret || secret.length < 32 || WEAK_JWT_SECRETS.has(secret)) {
    if (isProd) {
      throw new Error(
        'Refusing to start: set a strong JWT_SECRET (≥32 random characters) in .env'
      );
    }
    console.warn(
      '[security] JWT_SECRET is weak or missing. Generate one with: openssl rand -hex 32'
    );
  }
}

function isSettingKeyAllowed(key) {
  if (!key || BLOCKED_SETTING_KEYS.has(key)) return false;
  if (key === 'require_login') {
    return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DISABLE_LOGIN === 'true';
  }
  return ALLOWED_SETTING_KEYS.has(key);
}

function safeResolveUnder(baseDir, userPath) {
  const base = path.resolve(baseDir);
  const name = path.basename(String(userPath || ''));
  if (!name || name === '.' || name === '..') {
    throw new Error('Invalid file path');
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error('Invalid file path');
  }
  const resolved = path.resolve(base, name);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error('Invalid file path');
  }
  return resolved;
}

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) return { ok: false, reason: 'missing_secret' };
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return { ok: false, reason: 'missing_signature' };
  }
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'mismatch' };
  }
  return { ok: true };
}

function publicError(err, fallback = 'Something went wrong') {
  if (process.env.NODE_ENV === 'production') return fallback;
  return err?.message || fallback;
}

module.exports = {
  assertSecureEnv,
  isSettingKeyAllowed,
  safeResolveUnder,
  verifyMetaSignature,
  publicError,
  ALLOWED_SETTING_KEYS,
  BLOCKED_SETTING_KEYS,
};
