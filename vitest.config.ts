import { defineConfig } from 'vitest/config';

// Test layers follow docs/engineering/validation-and-release.zh-CN.md §1.
// No project sets passWithNoTests: a layer without tests must fail.
const roots = ['apps', 'packages', 'infra'].map((dir) => `${dir}/**`);
const exclude = ['**/node_modules/**'];
// Browser clients run in their own jsdom projects (React transform from each app's vite config).
const clientExclude = [...exclude, 'apps/web/**', 'apps/admin/**', 'apps/ios/**'];
const clientProject = (name: 'web' | 'admin') => ({
  extends: `./apps/${name}/vite.config.ts`,
  test: {
    name,
    root: `./apps/${name}`,
    environment: 'jsdom' as const,
    include: ['src/**/*.unit.test.{ts,tsx}'],
    exclude,
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: roots.map((r) => `${r}/*.unit.test.ts`), exclude: clientExclude } },
      clientProject('web'),
      clientProject('admin'),
      {
        test: {
          name: 'db',
          include: roots.map((r) => `${r}/*.db.test.ts`),
          exclude,
          globalSetup: ['packages/testkit/src/postgres/global-setup.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      { test: { name: 'release', include: roots.map((r) => `${r}/*.release.test.ts`), exclude, testTimeout: 60_000 } },
    ],
  },
});
