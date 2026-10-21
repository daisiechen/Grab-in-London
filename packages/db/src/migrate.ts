/**
 * Forward-only SQL migrator. Each file runs in its own transaction under an advisory lock;
 * applied files are pinned by checksum so edited history fails loudly instead of drifting.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

export const MIGRATIONS_DIR = join(import.meta.dirname, '../migrations');
const LOCK_KEY = 4_712_026_102_101; // arbitrary constant shared by every migrator process

export interface Migration {
  version: string;
  sql: string;
  checksum: string;
}

export function loadMigrations(dir = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const sql = readFileSync(join(dir, file), 'utf8');
      return { version: file.replace(/\.sql$/, ''), sql, checksum: createHash('sha256').update(sql).digest('hex') };
    });
}

export class MigrationChecksumError extends Error {}

export async function migrate(databaseUrl: string, migrations = loadMigrations()): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
    const { rows } = await client.query<{ version: string; checksum: string }>('SELECT version, checksum FROM schema_migrations');
    const done = new Map(rows.map((r) => [r.version, r.checksum]));
    for (const [version] of done) {
      if (!migrations.some((m) => m.version === version)) throw new MigrationChecksumError(`Applied migration ${version} is missing from the repository`);
    }
    for (const m of migrations) {
      const existing = done.get(m.version);
      if (existing) {
        if (existing !== m.checksum) throw new MigrationChecksumError(`Migration ${m.version} changed after it was applied`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [m.version, m.checksum]);
        await client.query('COMMIT');
        applied.push(m.version);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
  return applied;
}

/** Latest repository migration, used by readiness checks. */
export const latestMigration = (migrations = loadMigrations()) => migrations.at(-1)?.version ?? null;
