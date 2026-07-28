const cron = require('node-cron');
const pool = require('./db');
const { sendCampaign } = require('./whatsapp');
const { canSendMore } = require('./utils/limits');

function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const res = await pool.query(
        "SELECT id FROM campaigns WHERE status = 'scheduled' AND scheduled_at <= NOW()"
      );
      for (const row of res.rows) {
        sendCampaign(row.id);
      }
    } catch (err) {
      console.error('Scheduler error:', err);
    }
  });

  cron.schedule('0 * * * *', async () => {
    try {
      const limit = await canSendMore();
      if (!limit.allowed) return;

      const res = await pool.query("SELECT id FROM campaigns WHERE status = 'paused'");
      for (const row of res.rows) {
        sendCampaign(row.id);
      }
    } catch (err) {
      console.error('Paused campaign resume error:', err);
    }
  });
}

module.exports = { startScheduler };
