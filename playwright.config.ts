import { defineConfig, devices } from '@playwright/test';

/**
 * E2E: sobe API e web em portas próprias contra um banco exclusivo (*_e2e),
 * recriado no globalSetup. Nunca aponte E2E_DATABASE_URL para outro banco.
 */
const DB =
  process.env.E2E_DATABASE_URL ??
  'postgres://servicoflow:servicoflow@localhost:5432/servicoflow_e2e';
const KEY = 'c'.repeat(64);
const apiEnv = {
  APP_ENV: 'local',
  NODE_ENV: 'development',
  PORT: '3101',
  DATABASE_URL: DB,
  PUBLIC_APP_URL: 'http://localhost:3100',
  SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret-1234',
  TOKEN_PAYLOAD_ENCRYPTION_KEY: KEY,
  AUTH_RATE_LIMIT: 'false',
  STORAGE_LOCAL_DIR: '.e2e-storage',
  SMTP_URL: '',
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      // recria o banco, aplica migrations e só então inicia a API
      command:
        'node tests/e2e/prepare-db.mjs && pnpm --filter @servicoflow/api exec tsx src/db/migrate-cli.ts && pnpm --filter @servicoflow/api exec tsx src/main.ts',
      url: 'http://localhost:3101/api/v1/health/live',
      env: apiEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @servicoflow/web exec next dev --port 3100',
      url: 'http://localhost:3100/status',
      env: { API_INTERNAL_URL: 'http://localhost:3101' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});

export const E2E = { DB, KEY };
