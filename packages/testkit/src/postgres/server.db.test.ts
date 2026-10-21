import pg from 'pg';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { assertLocalUrl, assertPostgres17, createIsolatedDatabase, PostgresUnavailableError, TEST_DB_PREFIX } from './server.ts';

const serverUrl = inject('pgServerUrl');
const created: Array<{ drop(): Promise<void> }> = [];
afterAll(async () => {
  for (const db of created) await db.drop();
});

async function query<T extends pg.QueryResultRow>(url: string, sql: string): Promise<T[]> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query<T>(sql)).rows;
  } finally {
    await client.end();
  }
}

describe('PostgreSQL 17 test server', () => {
  it('is a real PostgreSQL 17 server', async () => {
    const [row] = await query<{ v: string; version: string }>(serverUrl, "select current_setting('server_version_num') v, version()");
    expect(Math.floor(Number(row!.v) / 10000)).toBe(17);
    expect(row!.version).toMatch(/^PostgreSQL 17\./);
    expect(inject('pgVersionNum')).toBe(Number(row!.v));
  });

  it('creates isolated databases that do not share tables', async () => {
    const a = await createIsolatedDatabase(serverUrl);
    const b = await createIsolatedDatabase(serverUrl);
    created.push(a, b);
    expect(a.name).not.toBe(b.name);
    expect(a.name.startsWith(TEST_DB_PREFIX)).toBe(true);
    await query(a.url, 'create table probe (id int primary key); insert into probe values (1)');
    expect(await query(a.url, 'select id from probe')).toEqual([{ id: 1 }]);
    await expect(query(b.url, 'select id from probe')).rejects.toThrow(/relation "probe" does not exist/);
  });

  it('drops a database with open connections', async () => {
    const db = await createIsolatedDatabase(serverUrl);
    const holder = new pg.Client({ connectionString: db.url });
    await holder.connect();
    holder.on('error', () => undefined);
    await db.drop();
    const rows = await query<{ n: string }>(serverUrl, `select count(*) n from pg_database where datname = '${db.name}'`);
    expect(rows[0]!.n).toBe('0');
    await holder.end().catch(() => undefined);
  });

  it('rejects non-17 servers and non-local hosts', () => {
    expect(() => assertPostgres17(160004)).toThrow(PostgresUnavailableError);
    expect(() => assertPostgres17(180000)).toThrow(/PostgreSQL 17 required/);
    expect(() => assertLocalUrl('postgres://u@db.example.test/x')).toThrow(/non-local/);
    expect(assertLocalUrl('postgres://u@127.0.0.1:1/x').hostname).toBe('127.0.0.1');
  });
});
