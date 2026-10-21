import { defineConfig } from 'vitest/config';

// Test layers follow docs/engineering/validation-and-release.zh-CN.md §1.
// No project sets passWithNoTests: a layer without tests must fail.
const roots = ['apps', 'packages', 'infra'].map((dir) => `${dir}/**`);
const exclude = ['**/node_modules/**'];

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: roots.map((r) => `${r}/*.unit.test.ts`), exclude } },
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
