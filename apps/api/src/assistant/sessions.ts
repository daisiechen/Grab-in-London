import { randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { AssistantError, AssistantRuntime, SESSION_TTL_MS, tokenHash, type SessionBinding } from '../../../../packages/assistant/src/index.ts';
import { activeSubject, transaction } from './transaction.ts';

/** Guest credentials authenticate only a 24h fixed-TTL anonymous quota subject, never a user. */
export async function createGuest(pool: Pool, clientRequestId: string = randomUUID(), ipHash?:string) {
  return transaction(pool,async c=>{
    if(ipHash){
      await c.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,[ipHash]);
      const {rows:[rate]}=await c.query(`SELECT count(*)::int n FROM guest_sessions WHERE ip_hash=$1 AND created_at>clock_timestamp()-interval '15 minutes'`,[ipHash]);
      if(rate.n>=10)throw new AssistantError('AI_QUOTA_EXCEEDED');
    }
    const token = randomBytes(32).toString('base64url');
    const id = randomUUID();
    const { rows: [row] } = await c.query(`WITH clock AS (SELECT clock_timestamp() now)
      INSERT INTO guest_sessions(id,token_hash,created_at,expires_at,client_request_id,ip_hash) SELECT $1,$2,now,now+interval '24 hours',$3,$4 FROM clock ON CONFLICT DO NOTHING RETURNING expires_at`, [id, tokenHash(token), clientRequestId,ipHash??null]);
    if(!row)throw new AssistantError('AI_CONFLICT');
    return { id, token, expiresAt: row.expires_at as Date };
  });
}
export async function authenticateGuest(pool: Pool, token: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AssistantError('AI_SESSION_EXPIRED');
  const { rows: [row] } = await pool.query(`SELECT id FROM guest_sessions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp()`, [tokenHash(token)]);
  if (!row) throw new AssistantError('AI_SESSION_EXPIRED');
  return `guest:${row.id}`;
}

export class SessionService {
  private readonly pool: Pool; readonly runtime: AssistantRuntime;
  constructor(pool: Pool, runtime: AssistantRuntime) { this.pool = pool; this.runtime = runtime; }
  async create(subject: string, previousRevokeHandle?: string, deviceChallenge?: string) {
    let createdId: string | null = null;
    try {
      return await transaction(this.pool, async (c) => {
        await activeSubject(c, subject);
        if (previousRevokeHandle) {
          this.runtime.revoke(subject, previousRevokeHandle);
          await c.query(`UPDATE ai_session_meta SET status='INVALIDATED',generation=generation+1 WHERE subject=$1 AND revoke_hash=$2 AND status='ACTIVE'`, [subject, tokenHash(previousRevokeHandle)]);
        }
        if(deviceChallenge){
          const previous=await c.query(`SELECT id FROM ai_session_meta WHERE subject=$1 AND bootstrap_hash=$2`,[subject,tokenHash(deviceChallenge)]);
          if(previous.rows.length)throw new AssistantError('AI_CONFLICT');
        }
        const epoch = await preferenceEpoch(c, subject);
        const session = this.runtime.create(subject, epoch);
        createdId = session.id;
        await c.query(`INSERT INTO ai_session_meta(id,subject,device_hash,revoke_hash,generation,preference_epoch,last_activity_at,expires_at,status,bootstrap_hash)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',$9)`, [session.id, subject, tokenHash(session.deviceToken), tokenHash(session.revokeHandle), session.generation, epoch, new Date(session.expiresAt-SESSION_TTL_MS), new Date(session.expiresAt), deviceChallenge?tokenHash(deviceChallenge):null]);
        return session;
      });
    } catch (error) {
      if (createdId) this.runtime.destroy(createdId);
      if((error as {code?:string}).code==='23505')throw new AssistantError('AI_CONFLICT');
      throw error;
    }
  }
  async read(id: string, binding: SessionBinding) {
    return transaction(this.pool, async (c) => { await this.validate(c, id, binding); return this.runtime.read(id, binding); });
  }
  async activity(id: string, binding: SessionBinding, eventId: string, kind: 'SEND' | 'EDIT' | 'EXPLICIT_ACTION') {
    return transaction(this.pool, async (c) => {
      await this.validate(c, id, binding);
      const expiresAt = this.runtime.activity(id, binding, eventId, kind);
      const activityAt = expiresAt - SESSION_TTL_MS;
      // Flush the actual observed activity instant; the flush clock never renews TTL.
      await c.query(`UPDATE ai_session_meta SET last_activity_at=$2,expires_at=$3 WHERE id=$1 AND ($4::boolean OR last_activity_at <= $2::timestamptz - interval '30 seconds')`, [id, new Date(activityAt), new Date(expiresAt),kind!=='EDIT']);
      return { expiresAt };
    });
  }
  async reset(id: string, binding: SessionBinding) {
    return transaction(this.pool, async (c) => {
      await this.validate(c,id,binding);
      this.runtime.destroy(id);
      await c.query(`UPDATE ai_session_meta SET status='INVALIDATED',generation=generation+1 WHERE id=$1`,[id]);
    });
  }
  async validate(c: PoolClient, id: string, binding: SessionBinding) {
    await activeSubject(c, binding.subject);
    const epoch = await preferenceEpoch(c, binding.subject);
    const { rows: [row] } = await c.query(`SELECT subject,device_hash,generation::text,preference_epoch::text,status FROM ai_session_meta WHERE id=$1 FOR SHARE`,[id]);
    if (!row || row.subject!==binding.subject || row.device_hash!==tokenHash(binding.deviceToken)) throw new AssistantError('AI_SESSION_EXPIRED');
    if (row.status!=='ACTIVE' || row.generation!==String(binding.generation) || row.preference_epoch!==epoch || epoch!==binding.preferenceEpoch) throw new AssistantError('AI_SUPERSEDED');
    this.runtime.read(id,binding); // RAM authority: stale DB activity never widens TTL.
  }
}
export async function preferenceEpoch(c: PoolClient, subject: string): Promise<string> {
  if (!subject.startsWith('user:')) return '0';
  const {rows:[row]}=await c.query(`SELECT epoch::text FROM ai_preferences WHERE user_id=$1 FOR SHARE`,[subject.slice(5)]);
  return row?.epoch ?? '0';
}

export { invalidateSubjectAI, invalidateUserAI } from './invalidate.ts';
