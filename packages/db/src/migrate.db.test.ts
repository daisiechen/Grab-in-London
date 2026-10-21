import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { getTableColumns, getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { createIsolatedDatabase } from '@fancy/testkit/postgres';
import { createMigratedDatabase, type MigratedDatabase } from '@fancy/testkit/db';
import { loadMigrations, migrate, MigrationChecksumError, MIGRATIONS_DIR } from './migrate.ts';
import * as schema from './schema/index.ts';

const serverUrl = inject('pgServerUrl');
let db: MigratedDatabase;
beforeAll(async () => { db = await createMigratedDatabase(serverUrl, migrate); });
afterAll(async () => { await db.drop(); });

const sqlError = (p: Promise<unknown>) => p.then(() => { throw new Error('expected SQL error'); }, (e: { code?: string; message: string }) => e);

describe('migrator', () => {
  it('applies to an empty database once and is then a no-op', async () => {
    const fresh = await createIsolatedDatabase(serverUrl);
    try {
      expect(await migrate(fresh.url)).toEqual(loadMigrations().map((m) => m.version));
      expect(await migrate(fresh.url)).toEqual([]);
    } finally {
      await fresh.drop();
    }
  });

  it('refuses an applied migration whose file changed or disappeared', async () => {
    const fresh = await createIsolatedDatabase(serverUrl);
    const dir = mkdtempSync(join(tmpdir(), 'fancy-mig-'));
    try {
      const [first] = loadMigrations();
      writeFileSync(join(dir, `${first!.version}.sql`), first!.sql);
      await migrate(fresh.url, loadMigrations(dir));
      writeFileSync(join(dir, `${first!.version}.sql`), first!.sql + '\n-- edited');
      await expect(migrate(fresh.url, loadMigrations(dir))).rejects.toBeInstanceOf(MigrationChecksumError);
      await expect(migrate(fresh.url, [])).rejects.toThrow(/missing from the repository/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      await fresh.drop();
    }
  });

  it('rolls back a failing migration completely', async () => {
    const fresh = await createIsolatedDatabase(serverUrl);
    try {
      const bad = [{ version: '0001_bad', sql: 'CREATE TABLE half (id int); SELECT 1/0;', checksum: 'x' }];
      await expect(migrate(fresh.url, bad)).rejects.toThrow(/division by zero/);
      const { Client } = (await import('pg')).default;
      const c = new Client({ connectionString: fresh.url });
      await c.connect();
      const { rows } = await c.query(`SELECT to_regclass('half') AS t, (SELECT count(*) FROM schema_migrations) AS n`);
      await c.end();
      expect(rows[0]).toEqual({ t: null, n: '0' });
    } finally {
      await fresh.drop();
    }
  });

  it('keeps Drizzle table definitions in column parity with the SQL migrations', async () => {
    const tables = Object.values(schema).filter((t: unknown): t is PgTable => typeof t === 'object' && t !== null && Symbol.for('drizzle:IsDrizzleTable') in t);
    expect(tables.length).toBe(11);
    for (const table of tables) {
      const { rows } = await db.pool.query<{ column_name: string; is_nullable: string }>(
        `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [getTableName(table)],
      );
      const columns = Object.values(getTableColumns(table));
      expect(columns.map((c) => c.name).sort(), getTableName(table)).toEqual(rows.map((r) => r.column_name).sort());
      for (const column of columns) {
        const row = rows.find((r) => r.column_name === column.name)!;
        expect(column.notNull, `${getTableName(table)}.${column.name}`).toBe(row.is_nullable === 'NO');
      }
    }
    expect(readFileSync(join(MIGRATIONS_DIR, '0001_core_kernel.sql'), 'utf8')).not.toMatch(/\bmeals\b|\bapplications\b|\bconversations\b/);
  });
});

describe('core kernel constraints', () => {
  it('enforces user status and positive version', async () => {
    expect((await sqlError(db.pool.query(`INSERT INTO users (status) VALUES ('BANNED')`))).code).toBe('23514');
    expect((await sqlError(db.pool.query(`INSERT INTO users (version) VALUES (0)`))).code).toBe('23514');
  });

  it('keeps business and audit history append-only outside an audited privacy purge', async () => {
    const { rows: [user] } = await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`);
    await db.pool.query(`INSERT INTO audit_events (actor_kind, actor_id, action, aggregate_type) VALUES ('USER', $1, 'x', 'user')`, [user.id]);
    expect((await sqlError(db.pool.query(`UPDATE audit_events SET action = 'y'`))).message).toMatch(/append-only/);
    expect((await sqlError(db.pool.query(`DELETE FROM audit_events`))).message).toMatch(/append-only/);
    await db.pool.query(`INSERT INTO business_events (aggregate_type, aggregate_id, aggregate_seq, kind, effective_at, actor_kind) VALUES ('meal', gen_random_uuid(), 1, 'k', now(), 'SYSTEM')`);
    expect((await sqlError(db.pool.query(`DELETE FROM business_events`))).message).toMatch(/append-only/);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL fancy.privacy_purge = 'on'`);
      await client.query(`DELETE FROM audit_events WHERE actor_id = $1`, [user.id]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    expect((await db.pool.query(`SELECT count(*) n FROM audit_events WHERE actor_id = $1`, [user.id])).rows[0].n).toBe('0');
  });

  it('requires a system actor to have no actor id and a user actor to have one', async () => {
    const insert = (kind: string, actor: string | null) => db.pool.query(
      `INSERT INTO business_events (aggregate_type, aggregate_id, aggregate_seq, kind, effective_at, actor_kind, actor_id) VALUES ('meal', gen_random_uuid(), 1, 'k', now(), $1, $2)`, [kind, actor]);
    expect((await sqlError(insert('SYSTEM', '6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11'))).code).toBe('23514');
    expect((await sqlError(insert('USER', null))).code).toBe('23514');
  });

  it('dedupes notifications and outbox per event, recipient and channel (including null recipients)', async () => {
    const { rows: [user] } = await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`);
    const event = '0b8a7c55-4d0f-4d55-8c5a-2b0f6c9d1e22';
    const n = `INSERT INTO notifications (event_id, recipient_id, template) VALUES ($1, $2, 'meal.cancelled')`;
    await db.pool.query(n, [event, user.id]);
    expect((await sqlError(db.pool.query(n, [event, user.id]))).code).toBe('23505');
    const o = `INSERT INTO outbox (event_id, recipient_id, channel, template) VALUES ($1, $2, 'EMAIL', 'deletion.done')`;
    await db.pool.query(o, [event, null]);
    expect((await sqlError(db.pool.query(o, [event, null]))).code).toBe('23505');
    expect((await sqlError(db.pool.query(`INSERT INTO outbox (event_id, channel, template) VALUES ($1, 'SMS', 'x')`, [event]))).code).toBe('23514');
  });

  it('keeps privacy_control a single undeletable row', async () => {
    expect((await sqlError(db.pool.query(`INSERT INTO privacy_control (id) VALUES (2)`))).code).toBe('23514');
    expect((await sqlError(db.pool.query(`DELETE FROM privacy_control`))).message).toMatch(/singleton/);
    expect((await db.pool.query(`SELECT id, epoch FROM privacy_control`)).rows).toEqual([{ id: 1, epoch: '0' }]);
  });

  it('ties job and idempotency state to their lease and completion columns', async () => {
    expect((await sqlError(db.pool.query(`INSERT INTO jobs (kind, resource_id, due_at, run_after, state) VALUES ('x.y', gen_random_uuid(), now(), now(), 'RUNNING')`))).code).toBe('23514');
    expect((await sqlError(db.pool.query(`INSERT INTO jobs (kind, resource_id, due_at, run_after, state) VALUES ('x.y', gen_random_uuid(), now(), now(), 'DONE')`))).code).toBe('23514');
    const { rows: [user] } = await db.pool.query(`INSERT INTO users DEFAULT VALUES RETURNING id`);
    expect((await sqlError(db.pool.query(
      `INSERT INTO idempotency (actor_id, operation, key, request_hash, state, claim_token, lease_until, expires_at)
       VALUES ($1, 'applyMeal', gen_random_uuid(), repeat('a', 64), 'COMPLETED', gen_random_uuid(), now(), now() + interval '1 day')`, [user.id]))).code).toBe('23514');
  });
});
