const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const [
      totalContacts,
      campaignsThisMonth,
      messagesSentThisMonth,
      deliveryRate,
      activeCampaigns,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM contacts'),
      pool.query(
        "SELECT COUNT(*) FROM campaigns WHERE created_at >= date_trunc('month', NOW())"
      ),
      pool.query(
        "SELECT COALESCE(SUM(sent_count), 0) AS total FROM campaigns WHERE sent_at >= date_trunc('month', NOW())"
      ),
      pool.query(
        'SELECT COALESCE(SUM(delivered_count), 0) AS delivered, COALESCE(SUM(sent_count), 0) AS sent FROM campaigns'
      ),
      pool.query("SELECT COUNT(*) FROM campaigns WHERE status = 'sending'"),
    ]);

    const delivered = parseInt(deliveryRate.rows[0].delivered, 10);
    const sent = parseInt(deliveryRate.rows[0].sent, 10);
    const rate = sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0;

    res.json({
      totalContacts: parseInt(totalContacts.rows[0].count, 10),
      campaignsThisMonth: parseInt(campaignsThisMonth.rows[0].count, 10),
      messagesSentThisMonth: parseInt(messagesSentThisMonth.rows[0].total, 10),
      deliveryRate: rate,
      activeCampaigns: parseInt(activeCampaigns.rows[0].count, 10),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/chart', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DATE(sent_at) AS date, SUM(sent_count) AS count
       FROM campaigns
       WHERE sent_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(sent_at)
       ORDER BY date`
    );

    const dataMap = {};
    for (const row of result.rows) {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      dataMap[dateStr] = parseInt(row.count, 10);
    }

    const chart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      chart.push({ date: dateStr, count: dataMap[dateStr] || 0 });
    }

    res.json(chart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/recent-campaigns', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, t.name AS template_name,
        CASE WHEN c.sent_count > 0
          THEN ROUND((c.delivered_count::numeric / c.sent_count) * 100, 1)
          ELSE 0
        END AS delivery_rate
       FROM campaigns c
       LEFT JOIN templates t ON t.id = c.template_id
       ORDER BY c.created_at DESC
       LIMIT 5`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/message-logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const status = req.query.status || '';
    const search = req.query.search || '';
    const campaignId = req.query.campaign_id || '';
    const dateFrom = req.query.date_from || '';
    const dateTo = req.query.date_to || '';
    const offset = (page - 1) * limit;

    const conditions = ['1=1'];
    const params = [];
    let paramIdx = 1;

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

    if (campaignId) {
      conditions.push(`ml.campaign_id = $${paramIdx}`);
      params.push(campaignId);
      paramIdx++;
    }

    if (dateFrom) {
      conditions.push(`ml.created_at >= $${paramIdx}`);
      params.push(dateFrom);
      paramIdx++;
    }

    if (dateTo) {
      conditions.push(`ml.created_at <= $${paramIdx}::date + INTERVAL '1 day'`);
      params.push(dateTo);
      paramIdx++;
    }

    const where = conditions.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM message_logs ml WHERE ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const logsRes = await pool.query(
      `SELECT ml.*, c.name AS campaign_name, ct.company
       FROM message_logs ml
       LEFT JOIN campaigns c ON c.id = ml.campaign_id
       LEFT JOIN contacts ct ON ct.id = ml.contact_id
       WHERE ${where}
       ORDER BY ml.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    const todayRes = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')) AS sent,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'read') AS read_count,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed
       FROM message_logs
       WHERE created_at >= CURRENT_DATE`
    );

    const stats = todayRes.rows[0];
    res.json({
      logs: logsRes.rows,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      todayStats: {
        sent: stats.sent,
        delivered: stats.delivered,
        read: stats.read_count,
        failed: stats.failed,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
