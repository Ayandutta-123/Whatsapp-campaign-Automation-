require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('./db');
const authMiddleware = require('./middleware/auth');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');
const { startScheduler } = require('./scheduler');
const { resumeInterruptedCampaigns, seedSettingsFromEnv } = require('./whatsapp');
const { ensureAdminCredentials } = require('./utils/password');
const { assertSecureEnv } = require('./utils/security');
const { resolveCorsOrigins, isOriginAllowed } = require('./utils/cors');
const webhookRouter = require('./webhook');

const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const templatesRoutes = require('./routes/templates');
const campaignsRoutes = require('./routes/campaigns');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const sendersRoutes = require('./routes/senders');
const aiRoutes = require('./routes/ai');
const notificationsRoutes = require('./routes/notifications');
const { repairInvalidSenderPhoneNumberIds } = require('./utils/senders');

assertSecureEnv();

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name TEXT,
      phone TEXT NOT NULL UNIQUE,
      company TEXT,
      email TEXT,
      tags TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      whatsapp_template_name TEXT NOT NULL,
      language TEXT DEFAULT 'en',
      category TEXT CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION')),
      body_text TEXT,
      variables TEXT[],
      header_type TEXT DEFAULT 'none',
      header_value TEXT,
      footer_text TEXT,
      button_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      total_contacts INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      read_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      variable_mapping JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS message_logs (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      contact_name TEXT,
      contact_phone TEXT,
      whatsapp_message_id TEXT,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      sent_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sender_numbers (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      country_prefix TEXT NOT NULL,
      phone_number_id TEXT NOT NULL,
      display_phone TEXT,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_notifications (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'info',
      category TEXT DEFAULT 'system',
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO settings (key, value) VALUES
      ('whatsapp_token', ''),
      ('phone_number_id', ''),
      ('webhook_verify_token', ''),
      ('business_name', 'WhatsApp Campaign Automation'),
      ('require_login', 'true'),
      ('send_delay_ms', '1000'),
      ('daily_send_limit', '1000'),
      ('waba_id', ''),
      ('meta_app_id', ''),
      ('meta_app_secret', ''),
      ('public_base_url', ''),
      ('admin_username', 'admin'),
      ('jwt_token_version', '1'),
      ('anthropic_api_key', '')
    ON CONFLICT (key) DO NOTHING;

    ALTER TABLE templates ADD COLUMN IF NOT EXISTS meta_status TEXT DEFAULT 'draft';
    ALTER TABLE templates ADD COLUMN IF NOT EXISTS meta_template_id TEXT;
    ALTER TABLE templates ADD COLUMN IF NOT EXISTS header_media_handle TEXT;
    ALTER TABLE templates ADD COLUMN IF NOT EXISTS header_image_preview TEXT;
    ALTER TABLE templates ADD COLUMN IF NOT EXISTS header_image_path TEXT;
    ALTER TABLE templates ADD COLUMN IF NOT EXISTS header_image_url TEXT;
    ALTER TABLE templates ADD COLUMN IF NOT EXISTS meta_rejection_reason TEXT;
    ALTER TABLE settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sender_mode TEXT DEFAULT 'auto';
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sender_number_id INTEGER REFERENCES sender_numbers(id) ON DELETE SET NULL;
    ALTER TABLE templates ADD COLUMN IF NOT EXISTS buttons JSONB DEFAULT '[]'::jsonb;
  `);

  await ensureAdminCredentials();
  await seedSettingsFromEnv();

  if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_LOGIN !== 'false') {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('require_login', 'true')
       ON CONFLICT (key) DO UPDATE SET value = 'true'`
    );
  }

  const hookRes = await pool.query(
    "SELECT value FROM settings WHERE key = 'webhook_verify_token'"
  );
  const hookVal = hookRes.rows[0]?.value || '';
  if (!hookVal || hookVal === 'hts_verify_2025') {
    const fresh = crypto.randomBytes(24).toString('hex');
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('webhook_verify_token', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [fresh]
    );
    console.log('[security] Generated new webhook_verify_token — copy it from Settings');
  }

  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('jwt_token_version', '1')
     ON CONFLICT (key) DO NOTHING`
  );

  // Migrate old brand name
  await pool.query(
    `UPDATE settings SET value = 'WhatsApp Campaign Automation'
     WHERE key = 'business_name'
       AND (value ILIKE '%hyperthink%' OR value IS NULL OR value = '')`
  );

  if (process.env.APP_PUBLIC_URL?.trim()) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('public_base_url', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
       WHERE settings.value IS NULL OR settings.value = ''`,
      [process.env.APP_PUBLIC_URL.trim()]
    );
  }

  console.log('Database initialized');
}

const corsOrigins = resolveCorsOrigins();
const allowAnyOrigin = corsOrigins.includes('*');

app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: allowAnyOrigin ? ["'self'", '*'] : ["'self'", ...corsOrigins],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin, corsOrigins)) return callback(null, true);
      console.warn(
        `Blocked cross-origin request from ${origin}. ` +
          'Add it to CORS_ORIGINS (comma-separated) in .env to allow it.'
      );
      callback(null, false);
    },
    credentials: true,
  })
);

app.use(
  '/webhook',
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
  webhookRouter
);

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

const uploadsDir = require('./utils/paths').resolveUploadsDir();
fs.mkdirSync(path.join(uploadsDir, 'headers'), { recursive: true });
app.use(
  '/uploads',
  express.static(uploadsDir, {
    dotfiles: 'deny',
    index: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  })
);

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.json({
      message: 'WhatsApp Campaign Automation API',
      ui: 'Run npm run dev for the React UI (Vite proxies /api to this server)',
      health: '/health',
    });
  });
}

app.use('/api/auth', authLimiter, authRoutes);

const apiRouter = express.Router();
apiRouter.use(authMiddleware);
apiRouter.use(apiLimiter);
apiRouter.use('/contacts', contactsRoutes);
apiRouter.use('/templates', templatesRoutes);
apiRouter.use('/campaigns', campaignsRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/senders', sendersRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/notifications', notificationsRoutes);
app.use('/api', apiRouter);

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/webhook') ||
      req.path.startsWith('/uploads') ||
      req.path === '/health'
    ) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

async function checkMetaConnectivity() {
  const https = require('https');
  await new Promise((resolve) => {
    const req = https.request(
      { hostname: 'graph.facebook.com', port: 443, path: '/', method: 'HEAD', timeout: 5000 },
      (res) => {
        console.log(`Meta Graph API reachable (graph.facebook.com responded ${res.statusCode})`);
        res.resume();
        resolve();
      }
    );
    req.on('timeout', () => {
      req.destroy();
      console.warn(
        '⚠️  Meta Graph API check timed out reaching graph.facebook.com. ' +
          'WhatsApp sends will fail until outbound network access to Meta is available. ' +
          'If this host is running behind a firewall/proxy/VPN or a sandboxed shell, allow HTTPS to graph.facebook.com:443.'
      );
      resolve();
    });
    req.on('error', (err) => {
      console.warn(
        `⚠️  Meta Graph API unreachable (graph.facebook.com): ${err.message}. ` +
          'WhatsApp sends will fail until outbound network access to Meta is available. ' +
          'If this host is running behind a firewall/proxy/VPN or a sandboxed shell, allow HTTPS to graph.facebook.com:443.'
      );
      resolve();
    });
    req.end();
  });
}

async function start() {
  try {
    await initDB();
    const repaired = await repairInvalidSenderPhoneNumberIds();
    if (repaired > 0) {
      console.log(`Repaired ${repaired} invalid sender phone_number_id value(s)`);
    }
    startScheduler();
    await resumeInterruptedCampaigns();
    checkMetaConnectivity().catch(() => {});
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err?.message || err);
  if (process.env.NODE_ENV === 'production') process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err?.message || err);
  if (process.env.NODE_ENV === 'production') process.exit(1);
});

start();
