const fs = require('fs');
const path = require('path');
const { resolveBackupsDir } = require('./paths');

const BACKUP_DIR = resolveBackupsDir();
const TABLES = [
  'contacts',
  'templates',
  'campaigns',
  'message_logs',
  'settings',
  'sender_numbers',
];

function ensureBackupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function createBackup(pool) {
  ensureBackupDir();

  const backup = {
    version: 1,
    created_at: new Date().toISOString(),
    tables: {},
  };

  const SENSITIVE_SETTING_KEYS = new Set([
    'whatsapp_token',
    'admin_password_hash',
    'webhook_verify_token',
    'anthropic_api_key',
    'meta_app_secret',
  ]);

  for (const table of TABLES) {
    try {
      const res = await pool.query(`SELECT * FROM ${table}`);
      if (table === 'settings') {
        backup.tables[table] = res.rows.map((row) =>
          SENSITIVE_SETTING_KEYS.has(row.key)
            ? { ...row, value: row.value ? '[REDACTED]' : '' }
            : row
        );
      } else {
        backup.tables[table] = res.rows;
      }
    } catch {
      backup.tables[table] = [];
    }
  }

  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

  return { filename, filepath, size: fs.statSync(filepath).size };
}

function listBackups() {
  ensureBackupDir();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((filename) => {
      const filepath = path.join(BACKUP_DIR, filename);
      const stat = fs.statSync(filepath);
      return {
        filename,
        size: stat.size,
        created_at: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getBackupPath(filename) {
  const { safeResolveUnder } = require('./security');
  if (!filename || !String(filename).endsWith('.json')) {
    throw new Error('Invalid backup filename');
  }
  const filepath = safeResolveUnder(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) throw new Error('Backup not found');
  return filepath;
}

module.exports = { createBackup, listBackups, getBackupPath, BACKUP_DIR };
