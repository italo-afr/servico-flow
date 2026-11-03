import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

function loadEnvFile(): Record<string, string> {
  const p = new URL('../../.env', import.meta.url);
  return existsSync(p) ? (parseEnv(readFileSync(p, 'utf8')) as Record<string, string>) : {};
}

export default defineConfig({
  test: {
    env: { ...loadEnvFile(), APP_ENV: 'test', NODE_ENV: 'test' },
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
