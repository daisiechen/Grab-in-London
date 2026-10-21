import type { PoolClient } from 'pg';
import { InvariantError } from './errors.ts';

/**
 * Global lock order (data contract §2): user → meal → pair → conversation → revision, ascending
 * id within a level; privacy_control is the very last, global short lock. Slices register the
 * table backing each level; every lock goes through LockSession so order violations throw
 * instead of risking deadlocks.
 */
export const LOCK_LEVELS = ['user', 'meal', 'pair', 'conversation', 'revision', 'privacy'] as const;
export type LockLevel = (typeof LOCK_LEVELS)[number];
export type LockMode = 'share' | 'update';

const TABLES = new Map<string, LockLevel>([['users', 'user']]);

/** Called once by a slice's module to make its table lockable at a level. */
export function registerLockTable(table: string, level: LockLevel): void {
  if (!/^[a-z][a-z0-9_]*$/.test(table)) throw new InvariantError(`invalid table name ${table}`);
  const existing = TABLES.get(table);
  if (existing && existing !== level) throw new InvariantError(`${table} already registered at ${existing}`);
  TABLES.set(table, level);
}

export interface LockedRow {
  id: string;
}

export class LockSession {
  private levelIndex = -1;
  private lastId: string | null = null;
  private clockRead = false;
  readonly held: Array<{ table: string; id: string; mode: LockMode }> = [];

  private readonly client: PoolClient;

  constructor(client: PoolClient) {
    this.client = client;
  }

  /**
   * Locks rows of `table` in ascending id order and returns those that exist. Locking a lower level
   * after a higher one, or an id not greater than the last at the same level, is an invariant error.
   */
  async lock<R extends LockedRow = LockedRow>(table: string, ids: readonly string[], mode: LockMode, columns = 'id'): Promise<R[]> {
    const level = TABLES.get(table);
    if (!level) throw new InvariantError(`table ${table} is not registered for locking`);
    if (this.clockRead) throw new InvariantError('locks must be taken before effectiveNow is read');
    const index = LOCK_LEVELS.indexOf(level);
    const sorted = [...new Set(ids.map((id) => id.toLowerCase()))].sort();
    if (!sorted.length) return [];
    if (index < this.levelIndex) throw new InvariantError(`lock order violation: ${level} after ${LOCK_LEVELS[this.levelIndex]}`);
    if (index === this.levelIndex && this.lastId !== null && sorted[0]! <= this.lastId) {
      throw new InvariantError(`lock order violation: ${table} ${sorted[0]} not after ${this.lastId}`);
    }
    // LockRows sits above Sort, so rows are locked in ORDER BY order.
    const { rows } = await this.client.query<R>(
      `SELECT ${columns} FROM ${table} WHERE id = ANY($1::uuid[]) ORDER BY id FOR ${mode === 'update' ? 'UPDATE' : 'SHARE'}`,
      [sorted],
    );
    this.levelIndex = index;
    this.lastId = sorted.at(-1)!;
    for (const id of sorted) this.held.push({ table, id, mode });
    return rows;
  }

  /** Last-level global short lock shared by deletion and snapshot publication; returns the epoch. */
  async privacyControl(): Promise<bigint> {
    if (this.clockRead) throw new InvariantError('locks must be taken before effectiveNow is read');
    if (this.levelIndex === LOCK_LEVELS.indexOf('privacy')) throw new InvariantError('privacy_control already locked');
    this.levelIndex = LOCK_LEVELS.indexOf('privacy');
    this.lastId = null;
    const { rows } = await this.client.query<{ epoch: string }>('SELECT epoch FROM privacy_control WHERE id = 1 FOR UPDATE');
    return BigInt(rows[0]!.epoch);
  }

  /** Marks the lock phase closed; called by effectiveNow. */
  closeLockPhase(): void {
    this.clockRead = true;
  }
}
