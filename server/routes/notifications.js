const express = require('express');
const {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  clearAllNotifications,
  clearReadNotifications,
} = require('../utils/notifications');
const { publicError } = require('../utils/security');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
    const [items, count] = await Promise.all([
      listNotifications({ limit: req.query.limit, unreadOnly: false }),
      unreadCount(),
    ]);
    res.json({ items, unread_count: count });
  } catch (err) {
    res.status(500).json({ error: publicError(err) });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    res.json({ count: await unreadCount() });
  } catch (err) {
    res.status(500).json({ error: publicError(err) });
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    await markRead(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: publicError(err) });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    await markAllRead();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: publicError(err) });
  }
});

router.delete('/read', async (req, res) => {
  try {
    await clearReadNotifications();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: publicError(err) });
  }
});

router.delete('/all', async (req, res) => {
  try {
    await clearAllNotifications();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: publicError(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deleteNotification(parseInt(req.params.id, 10));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: publicError(err) });
  }
});

module.exports = router;
