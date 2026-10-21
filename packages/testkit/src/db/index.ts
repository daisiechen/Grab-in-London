import '../postgres/context.ts';
import pg from 'pg';
import { createIsolatedDatabase } from '../postgres/server.ts';

export interface MigratedDatabase {
  url: string;
  pool: pg.Pool;
  /** Opens a dedicated connection (for barrier-controlled concurrent transactions). */
  connect(): Promise<pg.Client>;
  drop(): Promise<void>;
}

/** Fresh database on the PostgreSQL 17 test server with all repository migrations applied. */
export async function createMigratedDatabase(serverUrl: string, migrate: (url: string) => Promise<unknown>): Promise<MigratedDatabase> {
  const db = await createIsolatedDatabase(serverUrl);
  await migrate(db.url);
  const pool = new pg.Pool({ connectionString: db.url, max: 20 });
  const clients: pg.Client[] = [];
  return {
    url: db.url,
    pool,
    async connect() {
      const client = new pg.Client({ connectionString: db.url });
      client.on('error', () => undefined);
      await client.connect();
      clients.push(client);
      return client;
    },
    async drop() {
      for (const c of clients) await c.end().catch(() => undefined);
      await pool.end();
      await db.drop();
    },
  };
}

/**
 * Deterministic interleaving instead of sleeps: `await gate.wait('a')` blocks until
 * `gate.open('a')`. Used to hold one transaction at a point while another runs.
 */
export function createGates() {
  const gates = new Map<string, { promise: Promise<void>; open: () => void }>();
  const get = (name: string) => {
    let gate = gates.get(name);
    if (!gate) {
      let open!: () => void;
      const promise = new Promise<void>((resolve) => { open = resolve; });
      gate = { promise, open };
      gates.set(name, gate);
    }
    return gate;
  };
  return { wait: (name: string) => get(name).promise, open: (name: string) => get(name).open() };
}

/** Polls pg_stat_activity until `count` backends of this database are waiting on a lock. */
export async function waitForLockWaiters(pool: pg.Pool, count: number, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if (Number(rows[0]!.n) >= count) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${count} lock waiter(s)`);
    await new Promise((r) => setTimeout(r, 10));
  }
}
