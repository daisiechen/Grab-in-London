import type { Pool } from 'pg';
import { AssistantError, emptyPreferences, validatePreferences, type AssistantRuntime } from '../../../../packages/assistant/src/index.ts';
import { activeSubject, transaction } from './transaction.ts';
import { invalidateSubjectAI } from './invalidate.ts';

/** User confirmation + CAS. Deliberately independent of model enablement or credentials. */
export class PreferenceService {
  private readonly pool: Pool; private readonly runtime: AssistantRuntime; private readonly areas: readonly string[];
  constructor(pool: Pool, runtime: AssistantRuntime, allowedAreas: readonly string[]) { this.pool = pool; this.runtime = runtime; this.areas = allowedAreas; }
  async read(userId: string) {
    return transaction(this.pool, async (c) => {
      await activeSubject(c, `user:${userId}`);
      const { rows } = await c.query(`SELECT fields,version::text,epoch::text,confirmed_at FROM ai_preferences WHERE user_id=$1`, [userId]);
      return rows[0] ?? { fields: emptyPreferences(), version: '0', epoch: '0', confirmed_at: null };
    });
  }
  async replace(userId: string, expectedVersion: string, fields: unknown, confirmation: boolean) {
    if (confirmation !== true) throw new AssistantError('AI_INVALID_PREFERENCES');
    return this.change(userId, expectedVersion, validatePreferences(fields, this.areas), false);
  }
  async remove(userId: string, expectedVersion: string) { return this.change(userId, expectedVersion, emptyPreferences(), true); }
  private async change(userId: string, expectedVersion: string, fields: unknown, deleted: boolean) {
    return transaction(this.pool, async (c) => {
      const subject = `user:${userId}`;
      await activeSubject(c, subject, true);
      await c.query(`INSERT INTO ai_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING`, [userId]);
      const { rows: [current] } = await c.query(`SELECT version::text FROM ai_preferences WHERE user_id=$1 FOR UPDATE`, [userId]);
      if (current.version !== expectedVersion) throw new AssistantError('AI_CONFLICT');
      // RAM invalidation is part of the transaction's acceptance barrier. Failure rolls back DB.
      await invalidateSubjectAI(c,this.runtime,subject,deleted?'PREFERENCES_DELETED':'PREFERENCES_CHANGED');
      const { rows: [next] } = await c.query(`UPDATE ai_preferences SET fields=$2,version=version+1,epoch=epoch+1,confirmed_at=CASE WHEN $3 THEN NULL ELSE clock_timestamp() END WHERE user_id=$1 RETURNING fields,version::text,epoch::text,confirmed_at`, [userId, JSON.stringify(fields), deleted]);
      return next;
    });
  }
}
