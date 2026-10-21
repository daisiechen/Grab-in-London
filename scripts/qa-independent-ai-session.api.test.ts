/** Independent controlled-provider probes. Helpers adapted from controller.db.test.ts; no real AI calls. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,beforeEach,describe,expect,inject,it} from 'vitest';
import {migrate} from '../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {AssistantRuntime,emptyPreferences,type SessionBinding} from '../packages/assistant/src/index.ts';
import {SessionService} from '../apps/api/src/assistant/sessions.ts';
import {PreferenceService} from '../apps/api/src/assistant/preferences.ts';
let db:MigratedDatabase;let userId:string;let hostId:string;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>{await db.drop();});
beforeEach(async()=>{userId=randomUUID();hostId=randomUUID();await db.pool.query(`INSERT INTO users(id) VALUES($1),($2)`,[userId,hostId]);});

let now=Date.now();
async function setup(saved=false){now=Date.now();const runtime=new AssistantRuntime({now:()=>now});if(saved)await new PreferenceService(db.pool,runtime,[]).replace(userId,'0',{...emptyPreferences(),budgetMaxPence:3500},true);const epoch=(await db.pool.query('SELECT epoch::text FROM ai_preferences WHERE user_id=$1',[userId])).rows[0]?.epoch??'0';const sessions=new SessionService(db.pool,runtime);const s=await sessions.create(`user:${userId}`);const b:SessionBinding={subject:`user:${userId}`,deviceToken:s.deviceToken,generation:s.generation,preferenceEpoch:epoch};return {runtime,sessions,s,b};}
describe('independent AI session time and device proofs',()=>{
 it('QA-AI-029 real activity only; duplicate events and reads do not renew, edit flush stores observed activity rather than DB flush time',async()=>{
  const h=await setup(),t0=now,ttl=1_800_000;now=t0+10_000;expect(await h.sessions.activity(h.s.id,h.b,'send-one','SEND')).toEqual({expiresAt:now+ttl});
  now=t0+20_000;const edit=await h.sessions.activity(h.s.id,h.b,'edit-one','EDIT');expect(edit.expiresAt).toBe(now+ttl);let row=(await db.pool.query('SELECT last_activity_at,expires_at FROM ai_session_meta WHERE id=$1',[h.s.id])).rows[0];expect(+row.last_activity_at).toBe(t0+10_000);expect(+row.expires_at).toBe(t0+10_000+ttl);
  now=t0+25_000;expect((await h.sessions.activity(h.s.id,h.b,'edit-one','EDIT')).expiresAt).toBe(t0+20_000+ttl);for(let i=0;i<3;i++)expect((await h.sessions.read(h.s.id,h.b)).expiresAt).toBe(t0+20_000+ttl);
  expect(()=>h.runtime.activity(h.s.id,h.b,'heartbeat-one','HEARTBEAT' as never)).toThrow('AI_CONFLICT');expect((await h.sessions.read(h.s.id,h.b)).expiresAt).toBe(t0+20_000+ttl);
  now=t0+40_000;await h.sessions.activity(h.s.id,h.b,'edit-two','EDIT');row=(await db.pool.query('SELECT last_activity_at,expires_at FROM ai_session_meta WHERE id=$1',[h.s.id])).rows[0];expect(+row.last_activity_at).toBe(now);expect(+row.expires_at).toBe(now+ttl);
  now=t0+50_000;await h.sessions.activity(h.s.id,h.b,'explicit-one','EXPLICIT_ACTION');now=t0+60_000;expect((await h.sessions.activity(h.s.id,h.b,'explicit-one','EXPLICIT_ACTION')).expiresAt).toBe(t0+50_000+ttl);expect((await h.sessions.read(h.s.id,h.b)).expiresAt).toBe(t0+50_000+ttl);
 });
 it('QA-AI-028 exact TTL expires without a background timer and destroys text conditions artifacts and in-flight signal',async()=>{
  const h=await setup(true),t0=now;const saved=(await db.pool.query('SELECT fields,version,epoch FROM ai_preferences WHERE user_id=$1',[userId])).rows[0];h.runtime.appendMessage(h.s.id,h.b,'user','QA_PRIVATE_TEMPORARY_TEXT');h.runtime.saveConditions(h.s.id,h.b,{hard:{budgetMaxPence:3500},cleared:[]});h.runtime.saveArtifact(h.s.id,h.b,'candidate',{text:'QA_PRIVATE_DRAFT'});const signal=h.runtime.begin(h.s.id,h.b);
  now=t0+1_799_999;expect((await h.sessions.read(h.s.id,h.b)).messages).toHaveLength(1);expect(signal.aborted).toBe(false);now=t0+1_800_000;await expect(h.sessions.read(h.s.id,h.b)).rejects.toThrow('AI_SESSION_EXPIRED');expect(signal.aborted).toBe(true);expect(()=>h.runtime.artifact(h.s.id,h.b,'candidate')).toThrow('AI_SESSION_EXPIRED');
  const next=await h.sessions.create(h.b.subject),binding={...h.b,deviceToken:next.deviceToken,generation:next.generation};expect((await h.sessions.read(next.id,binding)).text).toEqual([]);expect(h.runtime.conditions(next.id,binding)).toEqual({hard:{},cleared:[]});expect((await db.pool.query('SELECT fields,version,epoch FROM ai_preferences WHERE user_id=$1',[userId])).rows[0]).toEqual(saved);
 });
 it('QA-AI-031 refresh revokes previous handle, single session ID cannot read and text never persists or appears on a second device',async()=>{
  const h=await setup();const marker='QA_RAM_ONLY_'+randomUUID();h.runtime.appendMessage(h.s.id,h.b,'user',marker);const other=await h.sessions.create(h.b.subject),ob={...h.b,deviceToken:other.deviceToken,generation:other.generation};expect((await h.sessions.read(other.id,ob)).messages).toEqual([]);await expect(h.sessions.read(h.s.id,{...h.b,deviceToken:other.deviceToken})).rejects.toThrow('AI_SESSION_EXPIRED');await expect(h.sessions.read(h.s.id,{...h.b,deviceToken:''})).rejects.toThrow('AI_SESSION_EXPIRED');
  const refreshed=await h.sessions.create(h.b.subject,h.s.revokeHandle),rb={...h.b,deviceToken:refreshed.deviceToken,generation:refreshed.generation};await expect(h.sessions.read(h.s.id,h.b)).rejects.toThrow(/AI_SESSION_EXPIRED|AI_SUPERSEDED/);expect((await h.sessions.read(refreshed.id,rb)).messages).toEqual([]);expect((await h.sessions.read(other.id,ob)).messages).toEqual([]);const meta=(await db.pool.query('SELECT row_to_json(s)::text body FROM ai_session_meta s WHERE subject=$1',[h.b.subject])).rows;expect(JSON.stringify(meta)).not.toContain(marker);expect(JSON.stringify(meta)).not.toContain(h.s.deviceToken);
 });
});
