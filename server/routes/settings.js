const express = require('express');
const axios = require('axios');
const pool = require('../db');
const { changeAdminPassword } = require('../utils/password');
const { canSendMore } = require('../utils/limits');
const { testMetaAppId } = require('../meta');
const { getSetting } = require('../whatsapp');
const { createBackup, listBackups, getBackupPath } = require('../utils/backup');
const { isSettingKeyAllowed, publicError } = require('../utils/security');
const { graphApiBase } = require('../utils/paths');
const {
  sanitizePhoneNumberId,
  assertValidPhoneNumberId,
} = require('../utils/phoneNumberId');
const { pushNotification } = require('../utils/notifications');

const router = express.Router();

const HIDDEN_KEYS = new Set(['admin_password_hash', 'jwt_token_version']);
const MASKED_KEYS = new Set([
  'whatsapp_token',
  'webhook_verify_token',
  'anthropic_api_key',
  'meta_app_secret',
]);

function maskSecret(value) {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return '••••' + value.slice(-4);
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings ORDER BY key');

    const settings = {};
    for (const row of result.rows) {
      if (HIDDEN_KEYS.has(row.key)) continue;
      if (MASKED_KEYS.has(row.key) && row.value) {
        settings[row.key] = maskSecret(row.value);
        settings[`${row.key}_set`] = 'true';
      } else {
        settings[row.key] = row.value;
      }
    }

    // Login cannot be disabled in production
    if (process.env.NODE_ENV === 'production') {
      settings.require_login = 'true';
    }

    const limitInfo = await canSendMore();
    settings.daily_sent_today = String(limitInfo.sent);
    settings.daily_send_remaining = String(limitInfo.remaining);

    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: publicError(err) });
  }
});

router.patch('/', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    if (!isSettingKeyAllowed(key)) {
      return res.status(403).json({ error: `Setting "${key}" cannot be updated via API` });
    }

    let storeValue = value == null ? '' : String(value);
    if (key === 'phone_number_id' && storeValue.trim()) {
      try {
        storeValue = assertValidPhoneNumberId(storeValue);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    await pool.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, storeValue]
    );

    const responseValue = MASKED_KEYS.has(key) ? maskSecret(String(storeValue || '')) : storeValue;
    res.json({ success: true, key, value: responseValue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: publicError(err) });
  }
});

router.post('/test-connection', async (req, res) => {
  try {
    const token = await getSetting('whatsapp_token');
    const phoneNumberId = sanitizePhoneNumberId(await getSetting('phone_number_id'));

    if (!token || !phoneNumberId) {
      const err =
        'WhatsApp token and a valid Meta Phone Number ID must be configured (not a display phone number)';
      await pushNotification({
        type: 'error',
        category: 'settings',
        title: 'Connection test failed',
        message: err,
        link: '/settings',
      });
      return res.json({
        success: false,
        error: err,
      });
    }

    const response = await axios.get(`${graphApiBase()}/${phoneNumberId}`, {
      params: {
        fields:
          'display_phone_number,verified_name,code_verification_status,platform_type,account_mode,quality_rating,name_status',
        access_token: token,
      },
    });

    const metaAppCheck = await testMetaAppId();
    const platformType = response.data.platform_type || null;
    const needsRegistration =
      !platformType ||
      platformType === 'NOT_APPLICABLE' ||
      String(platformType).toUpperCase() === 'UNKNOWN';

    await pushNotification({
      type: needsRegistration ? 'warning' : metaAppCheck.valid ? 'success' : 'warning',
      category: 'settings',
      title: needsRegistration
        ? 'Number connected but not registered for Cloud API'
        : 'WhatsApp connection OK',
      message: needsRegistration
        ? `${response.data.verified_name || 'Number'} · ${response.data.display_phone_number || phoneNumberId}. Click Register Phone for Cloud API before sending.`
        : `${response.data.verified_name || 'Number'} · ${response.data.display_phone_number || phoneNumberId}${
            metaAppCheck.valid ? '' : ` · Meta App ID issue: ${metaAppCheck.error}`
          }`,
      link: '/settings',
    });

    res.json({
      success: true,
      phone: response.data.display_phone_number,
      name: response.data.verified_name,
      metaApp: metaAppCheck,
      phoneNumberId,
      platform_type: platformType,
      code_verification_status: response.data.code_verification_status || null,
      account_mode: response.data.account_mode || null,
      needs_registration: needsRegistration,
      warning: needsRegistration
        ? 'This phone number is verified in Meta but not registered for Cloud API messaging (error 133010). Use Register Phone below with a 6-digit PIN, then retry sending.'
        : null,
    });
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    await pushNotification({
      type: 'error',
      category: 'settings',
      title: 'Connection test failed',
      message,
      link: '/settings',
    });
    res.json({
      success: false,
      error: message,
    });
  }
});

router.post('/register-phone', async (req, res) => {
  try {
    const token = await getSetting('whatsapp_token');
    const phoneNumberId = sanitizePhoneNumberId(await getSetting('phone_number_id'));
    const pin = String(req.body?.pin || '').trim();

    if (!token || !phoneNumberId) {
      return res.status(400).json({
        error: 'Save WhatsApp Access Token and Phone Number ID first',
      });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({
        error: 'Enter a 6-digit PIN (this becomes the WhatsApp two-step verification PIN for this number)',
      });
    }

    const response = await axios.post(
      `${graphApiBase()}/${phoneNumberId}/register`,
      {
        messaging_product: 'whatsapp',
        pin,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    await pushNotification({
      type: 'success',
      category: 'settings',
      title: 'Phone registered for Cloud API',
      message: `Phone Number ID ${phoneNumberId} is registered. You can send campaigns now.`,
      link: '/settings',
    });

    res.json({
      success: true,
      data: response.data,
      message: 'Phone number registered for Cloud API. Retry your campaign.',
    });
  } catch (err) {
    const message =
      err.response?.data?.error?.error_user_msg ||
      err.response?.data?.error?.message ||
      err.message;
    await pushNotification({
      type: 'error',
      category: 'settings',
      title: 'Phone registration failed',
      message,
      link: '/settings',
    });
    res.status(400).json({ error: message });
  }
});

router.post('/change-password', async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    if (new_password !== confirm_password) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }
    await changeAdminPassword(current_password, new_password);
    // Invalidate all existing JWTs
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('jwt_token_version', '1')
       ON CONFLICT (key) DO UPDATE
       SET value = (COALESCE(NULLIF(settings.value, ''), '0')::int + 1)::text`
    );
    res.json({ success: true, message: 'Password changed — please sign in again' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/backup', async (req, res) => {
  try {
    const result = await createBackup(pool);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/backups', async (req, res) => {
  try {
    res.json(listBackups());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/backups/:filename', async (req, res) => {
  try {
    const filepath = getBackupPath(req.params.filename);
    res.download(filepath, req.params.filename);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/clear-old-logs', async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM message_logs WHERE created_at < NOW() - INTERVAL '30 days'"
    );
    res.json({ deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export-campaigns', async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const result = await pool.query(
      `SELECT c.name, t.name AS template, c.status, c.total_contacts,
              c.sent_count, c.delivered_count, c.read_count, c.failed_count,
              c.sent_at, c.created_at
       FROM campaigns c
       LEFT JOIN templates t ON t.id = c.template_id
       ORDER BY c.created_at DESC`
    );

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      result.rows.map((r) => ({
        Name: r.name,
        Template: r.template,
        Status: r.status,
        'Total Contacts': r.total_contacts,
        Sent: r.sent_count,
        Delivered: r.delivered_count,
        Read: r.read_count,
        Failed: r.failed_count,
        'Sent At': r.sent_at || '',
        Created: r.created_at,
      }))
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Campaigns');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=campaigns_summary.xlsx'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
