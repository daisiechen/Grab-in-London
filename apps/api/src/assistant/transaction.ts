import type { Pool, PoolClient } from 'pg';
import { AssistantError } from '../../../../packages/assistant/src/errors.ts';
export async function transaction<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function activeSubject(client: PoolClient, subject: string, update = false) {
  const [kind, id] = subject.split(':');
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) throw new AssistantError('AI_SESSION_EXPIRED');
  const q = kind === 'user'
    ? await client.query(`SELECT id FROM users WHERE id=$1 AND status='ACTIVE' FOR ${update ? 'UPDATE' : 'SHARE'}`, [id])
    : kind === 'guest' ? await client.query(`SELECT id FROM guest_sessions WHERE id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp() FOR SHARE`, [id]) : { rows: [] };
  if (!q.rows.length) throw new AssistantError('AI_SESSION_EXPIRED');
}
