const { describe, it } = require('node:test');
const assert = require('node:assert');
const { hashPassword, verifyPassword } = require('../server/utils/password');
const {
  mapMetaApiStatus,
} = require('../server/utils/metaStatus');

describe('password utils', () => {
  it('hashes and verifies password', () => {
    const hash = hashPassword('test-password-123');
    assert.ok(hash.includes(':'));
    assert.strictEqual(verifyPassword('test-password-123', hash), true);
    assert.strictEqual(verifyPassword('wrong-password', hash), false);
  });
});

describe('meta status utils', () => {
  it('maps Meta API statuses to lowercase for display helpers', () => {
    assert.strictEqual(mapMetaApiStatus('APPROVED'), 'approved');
    assert.strictEqual(mapMetaApiStatus('PENDING'), 'pending');
    assert.strictEqual(mapMetaApiStatus('REJECTED'), 'rejected');
  });
});

describe('template name sanitization', () => {
  it('converts names to meta-safe format', () => {
    const name = 'Hello World 2025!'
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    assert.strictEqual(name, 'hello_world_2025');
  });
});

describe('daily limit logic', () => {
  it('calculates remaining sends', () => {
    const limit = 1000;
    const sent = 150;
    const remaining = Math.max(0, limit - sent);
    assert.strictEqual(remaining, 850);
    assert.strictEqual(sent < limit, true);
  });
});

describe('phone validation', () => {
  const { validatePhone, phoneValidationError } = require('../server/utils/phone');

  it('accepts valid Indian numbers', () => {
    assert.strictEqual(validatePhone('+917003901491'), true);
    assert.strictEqual(validatePhone('+919833023541'), true);
  });

  it('rejects wrong digit count for known countries', () => {
    assert.strictEqual(validatePhone('+91990262501'), false);
    assert.strictEqual(validatePhone('+9190734493660'), false);
  });

  it('returns helpful validation errors', () => {
    assert.ok(phoneValidationError('+91990262501').includes('expected 10 digits'));
  });
});

describe('cors origins', () => {
  const { resolveCorsOrigins, isOriginAllowed } = require('../server/utils/cors');
  const prod = { NODE_ENV: 'production' };

  it('collects origins from CORS_ORIGINS, APP_PUBLIC_URL and BASE_URL', () => {
    const origins = resolveCorsOrigins({
      CORS_ORIGINS: 'https://ui.example.com, https://staging.example.com/',
      APP_PUBLIC_URL: 'https://app.example.com/',
      BASE_URL: '',
    });
    assert.deepStrictEqual(origins, [
      'https://ui.example.com',
      'https://staging.example.com',
      'https://app.example.com',
    ]);
  });

  it('allows configured origins and blocks others in production', () => {
    const origins = resolveCorsOrigins({ CORS_ORIGINS: 'https://ui.example.com' });
    assert.strictEqual(isOriginAllowed('https://ui.example.com', origins, prod), true);
    assert.strictEqual(isOriginAllowed('https://evil.example.com', origins, prod), false);
  });

  it('allows same-origin requests that send no Origin header', () => {
    assert.strictEqual(isOriginAllowed(undefined, [], prod), true);
  });

  it('allows any origin when set to *', () => {
    const origins = resolveCorsOrigins({ CORS_ORIGINS: '*' });
    assert.strictEqual(isOriginAllowed('https://anything.example.com', origins, prod), true);
  });

  it('does not restrict origins outside production', () => {
    assert.strictEqual(
      isOriginAllowed('http://localhost:5173', [], { NODE_ENV: 'development' }),
      true
    );
  });
});

describe('sender prefix matching', () => {
  it('matches longest country prefix first', () => {
    const senders = [
      { country_prefix: '+1', phone_number_id: 'us' },
      { country_prefix: '+91', phone_number_id: 'in' },
      { country_prefix: '+971', phone_number_id: 'ae' },
    ].sort((a, b) => b.country_prefix.length - a.country_prefix.length);

    const phone = '+919876543210';
    const match = senders.find((s) => phone.startsWith(s.country_prefix));
    assert.strictEqual(match.phone_number_id, 'in');
  });
});
