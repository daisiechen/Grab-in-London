import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['scripts/qa-independent.api.test.ts'],globalSetup:['packages/testkit/src/postgres/global-setup.ts'],testTimeout:30000,hookTimeout:60000}});
