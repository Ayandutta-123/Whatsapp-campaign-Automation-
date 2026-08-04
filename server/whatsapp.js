const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pool = require('./db');
const { resolvePhoneNumberId } = require('./utils/senders');
const { canSendMore } = require('./utils/limits');
const { sanitizePhoneNumberId, enrichMetaSendError } = require('./utils/phoneNumberId');
const { pushNotification } = require('./utils/notifications');
const { safeResolveUnder } = require('./utils/security');

const { resolvePublicBaseUrl } = require('./utils/publicUrl');
const { graphApiBase, resolveHeadersDir } = require('./utils/paths');

const ENV_SETTING_KEYS = {
  whatsapp_token: 'WHATSAPP_TOKEN',
  phone_number_id: 'PHONE_NUMBER_ID',
  waba_id: 'WABA_ID',
  meta_app_id: 'META_APP_ID',
  meta_app_secret: 'META_APP_SECRET',
  public_base_url: ['APP_PUBLIC_URL', 'BASE_URL'],
};

async function getSetting(key) {
  const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  const dbValue = res.rows[0]?.value;
  if (dbValue != null && String(dbValue).trim() !== '') {
    return dbValue;
  }

  const envNames = ENV_SETTING_KEYS[key];
  if (!envNames) return dbValue ?? '';

  const names = Array.isArray(envNames) ? envNames : [envNames];
  for (const envName of names) {
    const envValue = process.env[envName]?.trim();
    if (envValue) return envValue;
  }

  return dbValue ?? '';
}

async function seedSettingsFromEnv() {
  for (const key of Object.keys(ENV_SETTING_KEYS)) {
    const res = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    const current = res.rows[0]?.value;
    if (current != null && String(current).trim() !== '') continue;

    const fromEnv = await getSetting(key);
    if (!fromEnv?.trim()) continue;

    await pool.query(
      'UPDATE settings SET value = $2, updated_at = NOW() WHERE key = $1',
      [key, fromEnv]
    );
    console.log(`Seeded ${key} from environment`);
  }
}

async function sendWhatsAppMessage(phone, templateName, languageCode, components, phoneNumberId) {
  const token = await getSetting('whatsapp_token');
  const numberId =
    sanitizePhoneNumberId(phoneNumberId) ||
    sanitizePhoneNumberId(await getSetting('phone_number_id'));

  if (!token) {
    return { success: false, error: 'WhatsApp Access Token is not configured in Settings' };
  }
  if (!numberId) {
    return {
      success: false,
      error:
        'Valid Meta Phone Number ID not found. Settings / Sender Numbers currently have a display phone (or empty value) instead of the long numeric Phone Number ID from Meta → WhatsApp → API Setup.',
    };
  }

  try {
    const response = await axios.post(
      `${graphApiBase()}/${numberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone.replace('+', ''),
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return {
      success: true,
      messageId: response.data.messages?.[0]?.id,
      phoneNumberId: numberId,
    };
  } catch (err) {
    const status = err.response?.status;
    const meta = err.response?.data?.error;
    let raw = meta?.message || err.message || 'Unknown error';
    if (!meta?.message && err.response?.data) {
      try {
        const bodyStr = JSON.stringify(err.response.data).slice(0, 500);
        raw = `HTTP ${status}: ${bodyStr}`;
      } catch {
        /* keep raw as-is */
      }
    }
    const details = [meta?.code && `code ${meta.code}`, meta?.error_subcode && `subcode ${meta.error_subcode}`]
      .filter(Boolean)
      .join(', ');
    const withCode = details ? `${raw} [${details}]` : raw;
    console.error(
      `WhatsApp send failed (phoneNumberId=${numberId}, status=${status ?? 'n/a'}):`,
      err.response?.data ? JSON.stringify(err.response.data) : err.message
    );
    return {
      success: false,
      error: enrichMetaSendError(withCode, numberId),
      phoneNumberId: numberId,
    };
  }
}

function isUnusableImageUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Prefer current Public App URL + filename over a stale header_image_url
 * (e.g. http://localhost:3001/... from an old upload). Meta cannot fetch localhost.
 */
function getPublicImageUrl(template) {
  const base = String(template?.public_base_url || '')
    .trim()
    .replace(/\/+$/, '');
  const fileName = template?.header_image_path
    ? path.basename(String(template.header_image_path))
    : '';

  if (base && fileName) {
    const built = `${base}/uploads/headers/${fileName}`;
    if (!isUnusableImageUrl(built)) return built;
  }

  const stored = template?.header_image_url;
  if (stored?.startsWith('http') && !isUnusableImageUrl(stored)) {
    return stored;
  }

  return null;
}

function readHeaderImageFile(headerImagePath) {
  const filePath = safeResolveUnder(resolveHeadersDir(), headerImagePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Header image file missing on server: ${path.basename(filePath)}`);
  }
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return { buffer, mime, fileName: path.basename(filePath) };
}

/**
 * Upload header bytes to WhatsApp Cloud API media storage.
 * Sending image.id is more reliable than image.link.
 */
async function uploadWhatsAppMedia(buffer, mimeType, fileName, phoneNumberId, token) {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType);
  form.append('file', new Blob([buffer], { type: mimeType }), fileName);

  const response = await axios.post(
    `${graphApiBase()}/${phoneNumberId}/media`,
    form,
    {
      headers: { Authorization: `Bearer ${token}` },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );

  const mediaId = response.data?.id;
  if (!mediaId) {
    throw new Error('Meta media upload returned no media id');
  }
  return mediaId;
}

/**
 * Build the header image parameter for an IMAGE template.
 * Prefers media id from a fresh upload; falls back to a public HTTPS link.
 */
async function resolveHeaderImageParameter(template, phoneNumberId, token) {
  if (template?.header_type !== 'image') return null;

  if (template.header_image_path) {
    try {
      const { buffer, mime, fileName } = readHeaderImageFile(template.header_image_path);
      const mediaId = await uploadWhatsAppMedia(
        buffer,
        mime,
        fileName,
        phoneNumberId,
        token
      );
      return { type: 'image', image: { id: mediaId } };
    } catch (err) {
      console.warn(
        `WhatsApp media upload failed for ${template.header_image_path}: ${err.message}. Falling back to public link.`
      );
    }
  }

  const imageUrl = getPublicImageUrl(template);
  if (imageUrl) {
    return { type: 'image', image: { link: imageUrl } };
  }

  throw new Error(
    'Image header template has no usable image for sending. Re-upload the logo/image on the template and ensure Public App URL is set.'
  );
}

function buildComponents(variableMapping, contact, template, headerParameter = null) {
  const components = [];

  if (headerParameter) {
    components.push({
      type: 'header',
      parameters: [headerParameter],
    });
  } else if (template?.header_type === 'image') {
    const imageUrl = getPublicImageUrl(template);
    if (imageUrl) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: { link: imageUrl },
          },
        ],
      });
    }
  }

  const fieldMap = {
    name: contact.name || '',
    company: contact.company || '',
    phone: contact.phone || '',
    email: contact.email || '',
  };

  if (variableMapping && Object.keys(variableMapping).length > 0) {
    const keys = Object.keys(variableMapping)
      .filter((k) => !k.endsWith('_custom'))
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    const parameters = keys.map((key) => {
      const mapping = variableMapping[key];
      let value = '';
      if (mapping === 'custom') {
        value = variableMapping[`${key}_custom`] || '';
      } else {
        value = fieldMap[mapping] || contact[mapping] || '';
      }
      return { type: 'text', text: String(value) };
    });

    if (parameters.length > 0) {
      components.push({ type: 'body', parameters });
    }
  }

  return components;
}

async function sendCampaign(campaignId) {
  try {
    const existing = await pool.query('SELECT status FROM campaigns WHERE id = $1', [
      campaignId,
    ]);
    if (existing.rows.length === 0) return;

    if (existing.rows[0].status !== 'sending') {
      await pool.query(
        "UPDATE campaigns SET status = 'sending', sent_at = COALESCE(sent_at, NOW()) WHERE id = $1",
        [campaignId]
      );
    }

    const campaignRes = await pool.query('SELECT * FROM campaigns WHERE id = $1', [
      campaignId,
    ]);
    const campaign = campaignRes.rows[0];
    if (!campaign) return;

    const templateRes = await pool.query('SELECT * FROM templates WHERE id = $1', [
      campaign.template_id,
    ]);
    const template = templateRes.rows[0];
    if (!template) {
      await pool.query("UPDATE campaigns SET status = 'failed' WHERE id = $1", [campaignId]);
      return;
    }

    const publicBaseSetting = await getSetting('public_base_url');
    const publicBase = resolvePublicBaseUrl(publicBaseSetting, null);
    const templateWithBase = { ...template, public_base_url: publicBase };
    const token = await getSetting('whatsapp_token');

    const delay = parseInt(await getSetting('send_delay_ms'), 10) || 1000;
    const variableMapping = campaign.variable_mapping || {};

    const logsRes = await pool.query(
      `SELECT ml.*, c.name, c.phone, c.company, c.email
       FROM message_logs ml
       LEFT JOIN contacts c ON c.id = ml.contact_id
       WHERE ml.campaign_id = $1 AND ml.status = 'pending'
       ORDER BY ml.id`,
      [campaignId]
    );

    let stoppedByLimit = false;

    for (const log of logsRes.rows) {
      const limitCheck = await canSendMore();
      if (!limitCheck.allowed) {
        stoppedByLimit = true;
        await pool.query(
          `UPDATE message_logs SET status = 'failed',
           error_message = $1 WHERE id = $2`,
          [
            `Daily send limit reached (${limitCheck.limit} messages/day). Remaining resumes tomorrow.`,
            log.id,
          ]
        );
        await pool.query(
          'UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1',
          [campaignId]
        );
        continue;
      }

      const contact = {
        name: log.name || log.contact_name,
        phone: log.phone || log.contact_phone,
        company: log.company,
        email: log.email,
      };

      const phoneNumberId = await resolvePhoneNumberId(contact.phone, campaign);

      let headerParameter = null;
      try {
        headerParameter = await resolveHeaderImageParameter(
          templateWithBase,
          sanitizePhoneNumberId(phoneNumberId) ||
            sanitizePhoneNumberId(await getSetting('phone_number_id')),
          token
        );
      } catch (err) {
        await pool.query(
          `UPDATE message_logs SET status = 'failed', error_message = $1 WHERE id = $2`,
          [err.message, log.id]
        );
        await pool.query(
          'UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1',
          [campaignId]
        );
        continue;
      }

      if (
        templateWithBase.header_type === 'image' &&
        !headerParameter
      ) {
        await pool.query(
          `UPDATE message_logs SET status = 'failed', error_message = $1 WHERE id = $2`,
          [
            'Image header template sent without an image parameter. Re-upload the logo and set Public App URL.',
            log.id,
          ]
        );
        await pool.query(
          'UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1',
          [campaignId]
        );
        continue;
      }

      const components = buildComponents(
        variableMapping,
        contact,
        templateWithBase,
        headerParameter
      );
      const result = await sendWhatsAppMessage(
        contact.phone,
        template.whatsapp_template_name,
        template.language || 'en',
        components,
        phoneNumberId
      );

      if (result.success) {
        await pool.query(
          `UPDATE message_logs SET status = 'sent', whatsapp_message_id = $1, sent_at = NOW()
           WHERE id = $2`,
          [result.messageId, log.id]
        );
        await pool.query(
          'UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1',
          [campaignId]
        );
      } else {
        await pool.query(
          `UPDATE message_logs SET status = 'failed', error_message = $1 WHERE id = $2`,
          [result.error, log.id]
        );
        await pool.query(
          'UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1',
          [campaignId]
        );
      }

      await new Promise((r) => setTimeout(r, delay));
    }

    const pendingRes = await pool.query(
      `SELECT COUNT(*) FROM message_logs WHERE campaign_id = $1 AND status = 'pending'`,
      [campaignId]
    );
    const pendingCount = parseInt(pendingRes.rows[0].count, 10);

    if (pendingCount > 0 && stoppedByLimit) {
      await pool.query("UPDATE campaigns SET status = 'paused' WHERE id = $1", [
        campaignId,
      ]);
      await pushNotification({
        type: 'warning',
        category: 'send',
        title: `Campaign paused: ${campaign.name}`,
        message: 'Daily send limit reached. Remaining messages resume tomorrow.',
        link: `/campaigns/${campaignId}`,
      });
    } else if (pendingCount > 0) {
      await pool.query("UPDATE campaigns SET status = 'sending' WHERE id = $1", [
        campaignId,
      ]);
    } else {
      await pool.query("UPDATE campaigns SET status = 'completed' WHERE id = $1", [
        campaignId,
      ]);
      const summary = await pool.query(
        'SELECT sent_count, failed_count, delivered_count FROM campaigns WHERE id = $1',
        [campaignId]
      );
      const s = summary.rows[0] || {};
      const failed = Number(s.failed_count) || 0;
      const sent = Number(s.sent_count) || 0;
      await pushNotification({
        type: failed > 0 && sent === 0 ? 'error' : failed > 0 ? 'warning' : 'success',
        category: 'send',
        title: `Campaign completed: ${campaign.name}`,
        message: `Sent ${sent}, failed ${failed}.`,
        link: `/campaigns/${campaignId}`,
      });
    }
  } catch (err) {
    console.error('sendCampaign error:', err);
    await pool.query("UPDATE campaigns SET status = 'failed' WHERE id = $1", [campaignId]);
    await pushNotification({
      type: 'error',
      category: 'send',
      title: `Campaign failed (#${campaignId})`,
      message: err.message || 'Unexpected send error',
      link: `/campaigns/${campaignId}`,
    });
  }
}

async function resumeInterruptedCampaigns() {
  try {
    const res = await pool.query("SELECT id FROM campaigns WHERE status = 'sending'");
    for (const row of res.rows) {
      console.log(`Resuming interrupted campaign #${row.id}`);
      sendCampaign(row.id);
    }
  } catch (err) {
    console.error('resumeInterruptedCampaigns error:', err);
  }
}

module.exports = {
  sendWhatsAppMessage,
  sendCampaign,
  resumeInterruptedCampaigns,
  getSetting,
  seedSettingsFromEnv,
  buildComponents,
  getPublicImageUrl,
  resolveHeaderImageParameter,
  isUnusableImageUrl,
};
