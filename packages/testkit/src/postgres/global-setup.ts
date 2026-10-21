import type { TestProject } from 'vitest/node';
import { startPostgres17 } from './server.ts';

import './context.ts';

/** One PostgreSQL 17 server per db test run; each test file creates its own database. */
export default async function setup(project: TestProject) {
  const server = await startPostgres17();
  project.provide('pgServerUrl', server.url);
  project.provide('pgVersionNum', server.versionNum);
  return () => server.stop();
}
