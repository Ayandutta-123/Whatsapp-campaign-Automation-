/**
 * Starts an embedded Postgres for local/dev when Docker/Homebrew Postgres
 * is not available. Matches .env credentials:
 *   whatsapp_user / hyperthink2025 / whatsapp_db @ localhost:5432
 */
const path = require('path');
const EmbeddedPostgres = require('embedded-postgres').default;

const PORT = Number(process.env.PG_PORT || 5432);
const DB_DIR = path.join(__dirname, '..', '.pgdata');

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DB_DIR,
    user: 'whatsapp_user',
    password: 'hyperthink2025',
    port: PORT,
    persistent: true,
  });

  try {
    await pg.initialise();
    console.log('Postgres cluster initialized at', DB_DIR);
  } catch (err) {
    const msg = String(err.message || err);
    if (!/already|exist|initdb/i.test(msg)) {
      // Re-init only if cluster missing; otherwise continue to start
      console.log('Init skipped:', msg.split('\n')[0]);
    }
  }

  await pg.start();
  console.log(`Postgres listening on localhost:${PORT}`);

  try {
    await pg.createDatabase('whatsapp_db');
    console.log('Created database whatsapp_db');
  } catch (err) {
    console.log('Database whatsapp_db ready');
  }

  const stop = async () => {
    console.log('\nStopping Postgres...');
    try {
      await pg.stop();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  // Keep process alive
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('Failed to start embedded Postgres:', err.message || err);
  process.exit(1);
});
