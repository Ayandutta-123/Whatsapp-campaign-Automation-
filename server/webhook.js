const express = require('express');
const pool = require('./db');
const { getSetting } = require('./whatsapp');
const { verifyMetaSignature } = require('./utils/security');
const { pushNotification } = require('./utils/notifications');

const router = express.Router();

function formatWebhookDeliveryError(status) {
  const err = status?.errors?.[0];
  if (!err) return 'Delivery failed (Meta webhook)';
  const parts = [
    err.title,
    err.message,
    err.error_data?.details,
    err.code != null ? `code ${err.code}` : null,
  ].filter(Boolean);
  return parts.join(' — ') || 'Delivery failed (Meta webhook)';
}

router.get('/', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const stored = await getSetting('webhook_verify_token');

  if (mode === 'subscribe' && token && stored && token === stored) {
    await pushNotification({
      type: 'success',
      category: 'webhook',
      title: 'Meta webhook verified',
      message: 'Callback URL verification succeeded.',
      link: '/settings',
    });
    return res.send(challenge);
  }

  await pushNotification({
    type: 'error',
    category: 'webhook',
    title: 'Meta webhook verification failed',
    message: 'hub.verify_token did not match Settings → Webhook Verify Token.',
    link: '/settings',
  });
  return res.status(403).send('Forbidden');
});

router.post('/', async (req, res) => {
  const secret =
    (await getSetting('meta_app_secret'))?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    '';
  const raw = req.rawBody;

  if (secret) {
    if (!raw) {
      await pushNotification({
        type: 'error',
        category: 'webhook',
        title: 'Webhook rejected',
        message: 'Missing raw body for signature check',
        link: '/settings',
      });
      return res.status(401).json({ error: 'Missing raw body for signature check' });
    }
    const check = verifyMetaSignature(
      raw,
      req.headers['x-hub-signature-256'],
      secret
    );
    if (!check.ok) {
      console.warn('Webhook signature rejected:', check.reason);
      await pushNotification({
        type: 'error',
        category: 'webhook',
        title: 'Webhook signature failed',
        message: `Meta HMAC check failed (${check.reason}). Check Meta App Secret.`,
        link: '/settings',
      });
      return res.sendStatus(401);
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('META_APP_SECRET not set — rejecting webhook POSTs in production');
    await pushNotification({
      type: 'error',
      category: 'webhook',
      title: 'Webhook not configured',
      message: 'Set META_APP_SECRET / Meta App Secret for production webhooks.',
      link: '/settings',
    });
    return res.status(503).json({ error: 'Webhook verification not configured' });
  }

  res.sendStatus(200);
  processWebhook(req.body).catch(async (err) => {
    console.error('Webhook processing error:', err);
    await pushNotification({
      type: 'error',
      category: 'webhook',
      title: 'Webhook processing error',
      message: err.message || 'Unknown error',
      link: '/logs',
    });
  });
});

async function processWebhook(body) {
  const statuses = body?.entry?.[0]?.changes?.[0]?.value?.statuses;
  if (!statuses || !Array.isArray(statuses)) return;

  for (const status of statuses) {
    const waId = status.id;
    const waStatus = status.status;
    const timestamp = status.timestamp;

    const logRes = await pool.query(
      `SELECT ml.id, ml.campaign_id, ml.status, ml.contact_phone, c.name AS campaign_name
       FROM message_logs ml
       LEFT JOIN campaigns c ON c.id = ml.campaign_id
       WHERE ml.whatsapp_message_id = $1`,
      [waId]
    );
    if (logRes.rows.length === 0) continue;

    const log = logRes.rows[0];
    const prevStatus = log.status;
    const link = log.campaign_id ? `/campaigns/${log.campaign_id}` : '/logs';

    if (waStatus === 'delivered') {
      await pool.query(
        `UPDATE message_logs SET status = 'delivered', delivered_at = to_timestamp($1::bigint)
         WHERE whatsapp_message_id = $2`,
        [timestamp, waId]
      );
      if (prevStatus !== 'delivered' && prevStatus !== 'read') {
        await pool.query(
          'UPDATE campaigns SET delivered_count = delivered_count + 1 WHERE id = $1',
          [log.campaign_id]
        );
        await pushNotification({
          type: 'success',
          category: 'webhook',
          title: 'Message delivered',
          message: `${log.contact_phone || 'Contact'} · ${log.campaign_name || `Campaign #${log.campaign_id}`}`,
          link,
        });
      }
    } else if (waStatus === 'read') {
      await pool.query(
        `UPDATE message_logs SET status = 'read', read_at = to_timestamp($1::bigint)
         WHERE whatsapp_message_id = $2`,
        [timestamp, waId]
      );
      if (prevStatus !== 'read') {
        await pool.query(
          'UPDATE campaigns SET read_count = read_count + 1 WHERE id = $1',
          [log.campaign_id]
        );
        if (prevStatus !== 'delivered') {
          await pool.query(
            'UPDATE campaigns SET delivered_count = delivered_count + 1 WHERE id = $1',
            [log.campaign_id]
          );
        }
        await pushNotification({
          type: 'success',
          category: 'webhook',
          title: 'Message read',
          message: `${log.contact_phone || 'Contact'} · ${log.campaign_name || `Campaign #${log.campaign_id}`}`,
          link,
        });
      }
    } else if (waStatus === 'failed') {
      const errorMessage = formatWebhookDeliveryError(status);
      await pool.query(
        `UPDATE message_logs SET status = 'failed', error_message = $1 WHERE whatsapp_message_id = $2`,
        [errorMessage, waId]
      );
      if (prevStatus !== 'failed') {
        await pool.query(
          'UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1',
          [log.campaign_id]
        );
        await pushNotification({
          type: 'error',
          category: 'webhook',
          title: 'Delivery failed',
          message: `${log.contact_phone || 'Contact'}: ${errorMessage}`,
          link,
        });
      }
    } else if (waStatus === 'sent') {
      await pool.query(
        `UPDATE message_logs SET status = 'sent', sent_at = COALESCE(sent_at, to_timestamp($1::bigint))
         WHERE whatsapp_message_id = $2`,
        [timestamp, waId]
      );
    }
  }
}

module.exports = router;
