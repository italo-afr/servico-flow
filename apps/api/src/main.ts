import { ConfigError, loadConfig } from './config.js';
import { createApp } from './app.js';
import { createPool } from './db/pool.js';
import { log } from './common/logger.js';

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
const db = createPool(config.DATABASE_URL, config.DATABASE_POOL_MAX);
db.on('error', (err) => log('error', 'db_pool_error', { error: err.message }));

const app = await createApp(config, db);
await app.listen(config.PORT, '0.0.0.0');
log('info', 'api_started', { port: config.PORT, env: config.APP_ENV });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    log('info', 'api_stopping', { signal });
    void app
      .close()
      .then(() => db.end())
      .finally(() => process.exit(0));
  });
}
