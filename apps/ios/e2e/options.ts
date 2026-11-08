import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StackOptions } from './stack.ts';

/**
 * Environment overrides: FANCY_E2E_ADMIN_URL (else FANCY_TEST_DATABASE_URL), FANCY_E2E_DATABASE,
 * FANCY_E2E_API_PORT, FANCY_E2E_WEB_PORT, FANCY_E2E_WEB_DIR, FANCY_E2E_REBUILD=0 (reuse the export).
 */
export function stackOptions(env: NodeJS.ProcessEnv = process.env): StackOptions {
  return {
    adminUrl: env.FANCY_E2E_ADMIN_URL ?? env.FANCY_TEST_DATABASE_URL ?? 'postgres://fancy@127.0.0.1:55432/postgres',
    database: env.FANCY_E2E_DATABASE ?? 'fancy_e2e',
    apiPort: Number(env.FANCY_E2E_API_PORT ?? 3310),
    webPort: Number(env.FANCY_E2E_WEB_PORT ?? 8090),
    webDir: env.FANCY_E2E_WEB_DIR ?? join(tmpdir(), 'fancy-e2e-web'),
    rebuildWeb: env.FANCY_E2E_REBUILD !== '0',
    otp: '000000',
  };
}
