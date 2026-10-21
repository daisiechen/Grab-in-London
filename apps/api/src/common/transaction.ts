import type { Pool, PoolClient } from 'pg';
import { LockSession } from './locks.ts';
import { DomainError, InvariantError } from './errors.ts';

export interface Tx {
  client: PoolClient;
  locks: LockSession;
  /**
   * The single instant for this command: DB clock_timestamp() read after all locks are held, so
   * a command that queued behind another lock sees the time it actually proceeds (not now()).
   */
  effectiveNow(): Promise<Date>;
}

const RETRYABLE = new Set(['40001', '40P01']); // serialization_failure, deadlock_detected

export interface TxOptions {
  maxAttempts?: number;
  /** Commit even when fn rejects with a DomainError (facts such as lifecycle catch-up stay). */
  commitOnDomainError?: boolean;
  isolation?: 'READ COMMITTED' | 'REPEATABLE READ';
  onRetry?: (code: string, attempt: number) => void;
}

/**
 * READ COMMITTED transaction with explicit row locks. Deadlock/serialization failures are retried
 * from scratch (the whole command re-reads state). Unexpected errors roll back everything.
 */
export async function withTransaction<T>(pool: Pool, fn: (tx: Tx) => Promise<T>, options: TxOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  for (let attempt = 1; ; attempt++) {
    const client = await pool.connect();
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${options.isolation ?? 'READ COMMITTED'}`);
      const locks = new LockSession(client);
      let now: Date | null = null;
      const tx: Tx = {
        client,
        locks,
        async effectiveNow() {
          if (!now) {
            locks.closeLockPhase();
            const { rows } = await client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
            now = rows[0]!.now;
          }
          return now;
        },
      };
      try {
        const result = await fn(tx);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        if (error instanceof DomainError && error.status < 500 && options.commitOnDomainError) {
          await client.query('COMMIT');
        } else {
          await client.query('ROLLBACK').catch(() => undefined);
        }
        throw error;
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code && RETRYABLE.has(code) && attempt < maxAttempts && !(error instanceof InvariantError)) {
        options.onRetry?.(code, attempt);
        continue; // finally releases this client before the next attempt
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
