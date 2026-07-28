const pool = require('../db');

async function pushNotification({ type = 'info', category = 'system', title, message = '', link = null }) {
  if (!title) return null;
  try {
    const res = await pool.query(
      `INSERT INTO app_notifications (type, category, title, message, link)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [type, category, String(title).slice(0, 200), String(message || '').slice(0, 2000), link]
    );
    return res.rows[0];
  } catch (err) {
    console.warn('pushNotification failed:', err.message);
    return null;
  }
}

async function listNotifications({ limit = 40, unreadOnly = false } = {}) {
  const params = [];
  let where = '';
  if (unreadOnly) {
    where = 'WHERE read = false';
  }
  params.push(Math.min(Math.max(parseInt(limit, 10) || 40, 1), 100));
  const res = await pool.query(
    `SELECT * FROM app_notifications ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return res.rows;
}

async function unreadCount() {
  const res = await pool.query(
    'SELECT COUNT(*)::int AS count FROM app_notifications WHERE read = false'
  );
  return res.rows[0]?.count || 0;
}

async function markRead(id) {
  await pool.query(
    'UPDATE app_notifications SET read = true WHERE id = $1',
    [id]
  );
}

async function markAllRead() {
  await pool.query('UPDATE app_notifications SET read = true WHERE read = false');
}

async function deleteNotification(id) {
  await pool.query('DELETE FROM app_notifications WHERE id = $1', [id]);
}

async function clearAllNotifications() {
  await pool.query('DELETE FROM app_notifications');
}

async function clearReadNotifications() {
  await pool.query('DELETE FROM app_notifications WHERE read = true');
}

module.exports = {
  pushNotification,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  clearAllNotifications,
  clearReadNotifications,
};
