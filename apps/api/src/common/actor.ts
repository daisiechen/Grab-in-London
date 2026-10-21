import type { Tx } from './transaction.ts';
import { DomainError } from './errors.ts';

/**
 * Every write holds the actor's users row FOR SHARE (deletion takes FOR UPDATE), so a request that
 * passed its checks cannot slip past a concurrent deletion barrier (data contract §2/§3).
 */
export async function lockActiveActor(tx: Tx, userId: string, mode: 'share' | 'update' = 'share'): Promise<{ id: string; version: string }> {
  const [row] = await tx.locks.lock<{ id: string; status: string; version: string }>('users', [userId], mode, 'id, status, version');
  if (!row || row.status !== 'ACTIVE') throw new DomainError('AUTH_REQUIRED', 'Your session is no longer valid.');
  return { id: row.id, version: row.version };
}
