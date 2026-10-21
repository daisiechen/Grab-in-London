/**
 * Real PostgreSQL 17 for tests. Never substitutes SQLite or an in-memory fake.
 *
 * Source of the server, in order:
 *  1. FANCY_TEST_DATABASE_URL — an existing server (e.g. infra/compose.yml);
 *  2. FANCY_PG_BIN — a PostgreSQL 17 bin directory; a throwaway cluster is
 *     initialised in a temp dir on a free loopback port and removed on stop.
 * Either way the server must report major version 17, otherwise tests fail.
 */
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import pg from 'pg';

const run = promisify(execFile);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
export const TEST_DB_PREFIX = 'fancy_test_';

export interface PostgresServer {
  /** Admin URL (maintenance database `postgres`). */
  url: string;
  versionNum: number;
  stop(): Promise<void>;
}

export class PostgresUnavailableError extends Error {
  constructor(detail: string) {
    super(
      `${detail}\nProvide PostgreSQL 17 via FANCY_PG_BIN=<pg17>/bin (e.g. \`source infra/dev-env.sh\`) ` +
        'or FANCY_TEST_DATABASE_URL (e.g. `docker compose -f infra/compose.yml up -d`). SQLite is not accepted.',
    );
    this.name = 'PostgresUnavailableError';
  }
}

export function assertPostgres17(versionNum: number): void {
  if (Math.floor(versionNum / 10000) !== 17) {
    throw new PostgresUnavailableError(`PostgreSQL 17 required, server reports server_version_num=${versionNum}`);
  }
}

/** Refuses anything but loopback so destructive test helpers cannot reach a shared server. */
export function assertLocalUrl(raw: string): URL {
  const url = new URL(raw);
  if (!LOCAL_HOSTS.has(url.hostname) && process.env.FANCY_TEST_DB_ALLOW_REMOTE !== '1') {
    throw new Error(`Refusing non-local test database host ${url.hostname}`);
  }
  return url;
}

export async function serverVersionNum(url: string): Promise<number> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ v: string }>("select current_setting('server_version_num') as v");
    return Number(rows[0]!.v);
  } finally {
    await client.end();
  }
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

export async function startPostgres17(env: NodeJS.ProcessEnv = process.env): Promise<PostgresServer> {
  const external = env.FANCY_TEST_DATABASE_URL;
  if (external) {
    assertLocalUrl(external);
    const versionNum = await serverVersionNum(external);
    assertPostgres17(versionNum);
    return { url: external, versionNum, stop: async () => {} };
  }

  const bin = env.FANCY_PG_BIN;
  if (!bin || !existsSync(join(bin, 'postgres'))) {
    throw new PostgresUnavailableError(bin ? `No postgres binary in FANCY_PG_BIN=${bin}` : 'No PostgreSQL 17 configured.');
  }
  const { stdout } = await run(join(bin, 'postgres'), ['--version']);
  if (!/\(PostgreSQL\) 17\./.test(stdout)) throw new PostgresUnavailableError(`FANCY_PG_BIN is not PostgreSQL 17: ${stdout.trim()}`);

  const dir = await mkdtemp(join(tmpdir(), 'fancy-pg-'));
  const data = join(dir, 'data');
  const port = await freePort();
  try {
    await run(join(bin, 'initdb'), ['-D', data, '-U', 'fancy', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
    // TCP only: Unix socket paths under macOS temp dirs exceed the 103-byte limit.
    const options = `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories='' -c fsync=off -c max_connections=200`;
    await run(join(bin, 'pg_ctl'), ['-D', data, '-o', options, '-l', join(dir, 'server.log'), '-w', 'start']);
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw new PostgresUnavailableError(`Could not start PostgreSQL 17: ${(error as Error).message}`);
  }
  const url = `postgres://fancy@127.0.0.1:${port}/postgres`;
  const versionNum = await serverVersionNum(url);
  assertPostgres17(versionNum);
  return {
    url,
    versionNum,
    stop: async () => {
      await run(join(bin, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop']).catch(() => undefined);
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export interface IsolatedDatabase {
  name: string;
  url: string;
  drop(): Promise<void>;
}

/** Creates a uniquely named empty database on the (local) test server. */
export async function createIsolatedDatabase(serverUrl: string): Promise<IsolatedDatabase> {
  const base = assertLocalUrl(serverUrl);
  const name = TEST_DB_PREFIX + randomBytes(6).toString('hex');
  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  try {
    await admin.query(`create database ${name}`);
  } finally {
    await admin.end();
  }
  const url = new URL(base.toString());
  url.pathname = '/' + name;
  return {
    name,
    url: url.toString(),
    drop: async () => {
      const client = new pg.Client({ connectionString: serverUrl });
      await client.connect();
      try {
        await client.query(`drop database if exists ${name} with (force)`);
      } finally {
        await client.end();
      }
    },
  };
}
