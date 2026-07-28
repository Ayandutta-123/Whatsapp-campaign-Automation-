import EmbeddedPostgres from 'embedded-postgres';
import fs from 'fs';
import path from 'path';

const databaseDir = './.pgdata';

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'whatsapp_user',
  password: 'hyperthink2025',
  port: 5432,
  persistent: true,
  onLog: (msg) => console.log('[postgres]', msg.trim()),
  onError: (err) => console.error('[postgres]', err),
});

const alreadyInitialised = fs.existsSync(path.join(databaseDir, 'PG_VERSION'));
if (!alreadyInitialised) {
  await pg.initialise();
}
await pg.start();

try {
  await pg.createDatabase('whatsapp_db');
} catch {
  // database may already exist on restart
}

console.log('PostgreSQL ready at postgresql://whatsapp_user:***@localhost:5432/whatsapp_db');

process.on('SIGINT', async () => {
  await pg.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pg.stop();
  process.exit(0);
});
