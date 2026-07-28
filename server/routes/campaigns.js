const express = require('express');
const XLSX = require('xlsx');
const pool = require('../db');
const { sendCampaign } = require('../whatsapp');

const router = express.Router();

async function getContactsForSelection(contactSelection) {
  if (!contactSelection || contactSelection.type === 'all') {
    const res = await pool.query('SELECT * FROM contacts ORDER BY id');
    return res.rows;
  }

  if (contactSelection.type === 'tags' && contactSelection.tags?.length > 0) {
    const res = await pool.query(
      'SELECT * FROM contacts WHERE tags && $1::text[] ORDER BY id',
      [contactSelection.tags]
    );
    return res.rows;
  }

  if (contactSelection.type === 'manual' && contactSelection.ids?.length > 0) {
    const res = await pool.query(
      'SELECT * FROM contacts WHERE id = ANY($1::int[]) ORDER BY id',
      [contactSelection.ids]
    );
    return res.rows;
  }

  return [];
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, t.name AS template_name,
        CASE WHEN c.sent_count > 0
          THEN ROUND((c.delivered_count::numeric / c.sent_count) * 100, 1)
          ELSE 0
        END AS delivery_rate
       FROM campaigns c
       LEFT JOIN templates t ON t.id = c.template_id
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, t.name AS template_name, t.whatsapp_template_name, t.body_text,
              s.label AS sender_label, s.country_prefix AS sender_country, s.display_phone AS sender_display_phone
       FROM campaigns c
       LEFT JOIN templates t ON t.id = c.template_id
       LEFT JOIN sender_numbers s ON s.id = c.sender_number_id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/progress', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sent_count, delivered_count, read_count, failed_count, total_contacts, status
       FROM campaigns WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const status = req.query.status || '';
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    const conditions = ['ml.campaign_id = $1'];
    const params = [req.params.id];
    let paramIdx = 2;

    if (status) {
      conditions.push(`ml.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    if (search) {
      conditions.push(
        `(ml.contact_name ILIKE $${paramIdx} OR ml.contact_phone ILIKE $${paramIdx})`
      );
      params.push(`%${search}%`);
      paramIdx++;
    }

    const where = conditions.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM message_logs ml WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const logsRes = await pool.query(
      `SELECT ml.*, c.company
       FROM message_logs ml
       LEFT JOIN contacts c ON c.id = ml.contact_id
       WHERE ${where}
       ORDER BY ml.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      logs: logsRes.rows,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ml.contact_name, ml.contact_phone, c.company, ml.status,
              ml.sent_at, ml.delivered_at, ml.read_at, ml.error_message
       FROM message_logs ml
       LEFT JOIN contacts c ON c.id = ml.contact_id
       WHERE ml.campaign_id = $1
       ORDER BY ml.id`,
      [req.params.id]
    );

    const data = result.rows.map((r) => ({
      Name: r.contact_name || '',
      Phone: r.contact_phone || '',
      Company: r.company || '',
      Status: r.status,
      'Sent At': r.sent_at ? new Date(r.sent_at).toISOString() : '',
      'Delivered At': r.delivered_at ? new Date(r.delivered_at).toISOString() : '',
      'Read At': r.read_at ? new Date(r.read_at).toISOString() : '',
      Error: r.error_message || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Logs');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=campaign_${req.params.id}_logs.xlsx`
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

router.post('/', async (req, res) => {
  try {
    const { name, template_id, contact_selection, scheduled_at, variable_mapping, sender_mode, sender_number_id } =
      req.body;

    const status = scheduled_at ? 'scheduled' : 'draft';
    const mode = sender_mode === 'fixed' ? 'fixed' : 'auto';

    const campaignRes = await pool.query(
      `INSERT INTO campaigns (name, template_id, status, scheduled_at, variable_mapping, sender_mode, sender_number_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        name,
        template_id,
        status,
        scheduled_at || null,
        JSON.stringify(variable_mapping || {}),
        mode,
        mode === 'fixed' && sender_number_id ? sender_number_id : null,
      ]
    );

    const campaign = campaignRes.rows[0];
    const contacts = await getContactsForSelection(contact_selection);

    for (const contact of contacts) {
      await pool.query(
        `INSERT INTO message_logs (campaign_id, contact_id, contact_name, contact_phone, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [campaign.id, contact.id, contact.name, contact.phone]
      );
    }

    await pool.query('UPDATE campaigns SET total_contacts = $1 WHERE id = $2', [
      contacts.length,
      campaign.id,
    ]);

    const updated = await pool.query('SELECT * FROM campaigns WHERE id = $1', [
      campaign.id,
    ]);

    res.status(201).json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/send', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.status, c.template_id, t.meta_status, t.name AS template_name
       FROM campaigns c
       LEFT JOIN templates t ON t.id = c.template_id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const row = result.rows[0];
    if (row.status !== 'draft' && row.status !== 'scheduled') {
      return res
        .status(400)
        .json({ error: `Cannot send campaign with status: ${row.status}` });
    }

    sendCampaign(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/resend-failed', async (req, res) => {
  try {
    const campaignRes = await pool.query('SELECT * FROM campaigns WHERE id = $1', [
      req.params.id,
    ]);

    if (campaignRes.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const original = campaignRes.rows[0];

    const failedLogs = await pool.query(
      `SELECT * FROM message_logs WHERE campaign_id = $1 AND status = 'failed'`,
      [req.params.id]
    );

    if (failedLogs.rows.length === 0) {
      return res.status(400).json({ error: 'No failed messages to resend' });
    }

    const newCampaignRes = await pool.query(
      `INSERT INTO campaigns
         (name, template_id, status, variable_mapping, total_contacts, sender_mode, sender_number_id)
       VALUES ($1, $2, 'draft', $3, $4, $5, $6) RETURNING *`,
      [
        `${original.name} (Retry)`,
        original.template_id,
        original.variable_mapping,
        failedLogs.rows.length,
        original.sender_mode || 'auto',
        original.sender_number_id || null,
      ]
    );

    const newCampaign = newCampaignRes.rows[0];

    for (const log of failedLogs.rows) {
      await pool.query(
        `INSERT INTO message_logs (campaign_id, contact_id, contact_name, contact_phone, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [newCampaign.id, log.contact_id, log.contact_name, log.contact_phone]
      );
    }

    // Start sending immediately — pending logs only move after sendCampaign runs
    sendCampaign(newCampaign.id);

    const started = await pool.query('SELECT * FROM campaigns WHERE id = $1', [
      newCampaign.id,
    ]);

    res.status(201).json(started.rows[0] || newCampaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM campaigns WHERE id = $1', [
      req.params.id,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
