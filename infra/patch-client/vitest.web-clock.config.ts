import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
/** P1.1-only replay environment. Does not change the sealed QA runner or OS/service clocks. */
export default defineConfig({
  test: {
    maxWorkers: 1,
    projects: [{
      extends: path('../../apps/web/vite.config.ts'),
      test: {
        name: 'p11-web',
        maxWorkers: 1,
        root: path('../../apps/web/'),
        environment: 'jsdom',
        include: ['src/**/*.unit.test.{ts,tsx}'],
        exclude: ['**/node_modules/**'],
        setupFiles: [path('../../apps/web/src/test/setup.ts'), path('./web-clock.setup.ts')],
        restoreMocks: true,
        unstubGlobals: true,
      },
    }],
  },
});
