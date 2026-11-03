import { hostname } from 'node:os';
import { ConfigError, loadConfig } from '../config.js';
import { log } from '../common/logger.js';
import { createPool } from '../db/pool.js';
import { createMailer } from '../notifications/mailer.js';
import { processOnce } from '../notifications/processor.js';
import { runMaintenance } from './maintenance.js';
import { createStorage } from '../attachments/storage.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
const db = createPool(config.DATABASE_URL, 3);
db.on('error', (err) => log('error', 'db_pool_error', { error: err.message }));
const mailer = createMailer(config);
const storage = createStorage(config);
const workerId = `${hostname()}-${process.pid}`;
let stopping = false;
for (const s of ['SIGTERM', 'SIGINT'] as const) process.once(s, () => (stopping = true));

log('info', 'worker_started', { workerId });
let lastMaintenance = 0;
while (!stopping) {
  try {
    await db.query(
      `INSERT INTO worker_heartbeats (worker_id, last_seen_at) VALUES ($1, now())
       ON CONFLICT (worker_id) DO UPDATE SET last_seen_at = now()`,
      [workerId],
    );
    const results = await processOnce({ db, config, mailer, workerId });
    if (results.length) log('info', 'outbox_batch', { workerId, results });
    if (Date.now() - lastMaintenance > 60_000) {
      await runMaintenance(db, storage);
      lastMaintenance = Date.now();
    }
    if (results.length === 0) await new Promise((r) => setTimeout(r, 2000));
  } catch (err) {
    log('error', 'worker_loop_error', { error: (err as Error).message });
    await new Promise((r) => setTimeout(r, 5000));
  }
}
await db.end();
log('info', 'worker_stopped', { workerId });
