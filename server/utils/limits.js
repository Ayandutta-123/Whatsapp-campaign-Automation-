const pool = require('../db');

async function getDailySendLimit() {
  const res = await pool.query(
    "SELECT value FROM settings WHERE key = 'daily_send_limit'"
  );
  return parseInt(res.rows[0]?.value, 10) || 1000;
}

async function getTodaySentCount() {
  const res = await pool.query(
    `SELECT COUNT(*) FROM message_logs
     WHERE sent_at >= CURRENT_DATE
     AND status IN ('sent', 'delivered', 'read')`
  );
  return parseInt(res.rows[0].count, 10);
}

async function canSendMore() {
  const limit = await getDailySendLimit();
  const sent = await getTodaySentCount();
  return { allowed: sent < limit, sent, limit, remaining: Math.max(0, limit - sent) };
}

module.exports = { getDailySendLimit, getTodaySentCount, canSendMore };
