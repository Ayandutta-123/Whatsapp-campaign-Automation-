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

describe('runtime env normalization', () => {
  const { normalizeRuntimeEnv } = require('../server/utils/security');
  const fs = require('fs');

  it('forces production when /.dockerenv exists and NODE_ENV is development', () => {
    const original = process.env.NODE_ENV;
    const allow = process.env.ALLOW_DEV_IN_DOCKER;
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_DEV_IN_DOCKER;

    const existsSync = fs.existsSync;
    fs.existsSync = (p) => (p === '/.dockerenv' ? true : existsSync(p));
    try {
      normalizeRuntimeEnv();
      assert.strictEqual(process.env.NODE_ENV, 'production');
    } finally {
      fs.existsSync = existsSync;
      process.env.NODE_ENV = original;
      if (allow === undefined) delete process.env.ALLOW_DEV_IN_DOCKER;
      else process.env.ALLOW_DEV_IN_DOCKER = allow;
    }
  });
});

describe('template image URL for sends', () => {
  const {
    getPublicImageUrl,
    buildComponents,
    detectBodyVarKeys,
    sanitizeTemplateParam,
  } = require('../server/whatsapp');

  it('prefers current public base + path over stale localhost header_image_url', () => {
    const url = getPublicImageUrl({
      header_type: 'image',
      header_image_path: 'abc.png',
      header_image_url: 'http://localhost:3001/uploads/headers/abc.png',
      public_base_url: 'https://whatsapp.example.com',
    });
    assert.strictEqual(url, 'https://whatsapp.example.com/uploads/headers/abc.png');
  });

  it('rejects localhost-only image URLs', () => {
    const url = getPublicImageUrl({
      header_type: 'image',
      header_image_url: 'http://127.0.0.1:3001/uploads/headers/abc.png',
      public_base_url: '',
    });
    assert.strictEqual(url, null);
  });

  it('includes header image link in components when URL is usable', () => {
    const components = buildComponents({}, { name: 'A' }, {
      header_type: 'image',
      header_image_path: 'abc.png',
      public_base_url: 'https://whatsapp.example.com',
    });
    assert.deepStrictEqual(components[0], {
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { link: 'https://whatsapp.example.com/uploads/headers/abc.png' },
        },
      ],
    });
  });

  it('uses provided media-id header parameter when supplied', () => {
    const components = buildComponents(
      {},
      { name: 'A' },
      { header_type: 'image' },
      { type: 'image', image: { id: 'media-123' } }
    );
    assert.deepStrictEqual(components[0].parameters[0].image, { id: 'media-123' });
  });

  it('omits image header when Meta template is TEXT (prevents #132018)', () => {
    const components = buildComponents(
      {},
      { name: 'A' },
      {
        header_type: 'image',
        header_image_path: 'abc.png',
        public_base_url: 'https://whatsapp.example.com',
        body_text: 'Hello {{1}}',
      },
      { type: 'image', image: { id: 'media-123' } },
      { metaHeaderFormat: 'TEXT', bodyVarKeys: ['1'] }
    );
    assert.strictEqual(components.find((c) => c.type === 'header'), undefined);
    assert.deepStrictEqual(components[0], {
      type: 'body',
      parameters: [{ type: 'text', text: 'A' }],
    });
  });

  it('sends body params from body_text even when variable_mapping is empty', () => {
    const components = buildComponents(
      {},
      { name: 'Ada', company: 'Acme' },
      { header_type: 'none', body_text: 'Hi {{1}} from {{2}}' }
    );
    assert.deepStrictEqual(components[0], {
      type: 'body',
      parameters: [
        { type: 'text', text: 'Ada' },
        { type: 'text', text: 'Acme' },
      ],
    });
  });

  it('sanitizes empty and newline body params', () => {
    assert.strictEqual(sanitizeTemplateParam(''), '-');
    assert.strictEqual(sanitizeTemplateParam('a\nb'), 'a b');
    const components = buildComponents(
      { '1': 'name' },
      { name: '' },
      { body_text: 'Hi {{1}}' }
    );
    assert.strictEqual(components[0].parameters[0].text, '-');
  });

  it('detects body var keys from template body', () => {
    assert.deepStrictEqual(
      detectBodyVarKeys({ body_text: 'A {{2}} and {{1}}' }),
      ['1', '2']
    );
  });
});

describe('meta template name versioning', () => {
  const { nextMetaTemplateName } = require('../server/meta');

  it('appends _v2 then increments', () => {
    assert.strictEqual(nextMetaTemplateName('promo_offer'), 'promo_offer_v2');
    assert.strictEqual(nextMetaTemplateName('promo_offer_v2'), 'promo_offer_v3');
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

describe('user-facing Meta errors', () => {
  const {
    formatUserFacingError,
    extractErrorCode,
  } = require('../server/utils/userErrors');

  it('maps 132018 to plain language with code', () => {
    const msg = formatUserFacingError({
      code: 132018,
      message: "(#132018) There's an issue with the parameters in your template",
    });
    assert.match(msg, /\[Error 132018\]/);
    assert.match(msg, /Why:/);
    assert.match(msg, /What to do:/);
    assert.doesNotMatch(msg, /Graph API/i);
  });

  it('maps 131026 undeliverable', () => {
    const msg = formatUserFacingError({ code: 131026, message: 'Message undeliverable' });
    assert.match(msg, /could not be delivered/i);
    assert.match(msg, /WhatsApp/i);
  });

  it('extracts code from legacy strings', () => {
    assert.strictEqual(
      extractErrorCode("(#132018) There's an issue with the parameters"),
      132018
    );
  });

  it('leaves already-formatted messages alone', () => {
    const original =
      '[Error 190] Access token expired or invalid\nWhy: x\nWhat to do: y';
    assert.strictEqual(formatUserFacingError(original), original);
  });
});
