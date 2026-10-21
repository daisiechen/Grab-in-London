import { createHmac } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { AssistantError, type SessionBinding } from '../../../../packages/assistant/src/index.ts';
import { activeSubject, transaction } from './transaction.ts';
import { SessionService } from './sessions.ts';

const canonical = (x: unknown): string => {
  if (x === undefined) throw new AssistantError('AI_CONFLICT');
  if (typeof x === 'number' && !Number.isFinite(x)) throw new AssistantError('AI_CONFLICT');
  if (x === null || typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return JSON.stringify(x);
  if (typeof x !== 'object') throw new AssistantError('AI_CONFLICT');
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  return `{${Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
};
export function payloadHmac(secret: string, payload: unknown): string {
  if (Buffer.byteLength(secret)<32) throw new AssistantError('AI_UNAVAILABLE');
  const serialized=canonical(payload);
  if(Buffer.byteLength(serialized)>64_000)throw new AssistantError('AI_CONFLICT');
  return createHmac('sha256',secret).update(serialized).digest('hex');
}
export type TerminalRequestState='SUCCEEDED'|'NEEDS_INPUT'|'FAILED'|'SUPERSEDED';

/** Durable subject-level single flight + requestId/HMAC dedup + day-fixed successful-turn quota. */
export class RequestService {
  private readonly pool:Pool; private readonly sessions:SessionService; private readonly secret:string;
  constructor(pool:Pool,sessions:SessionService,secret:string){this.pool=pool;this.sessions=sessions;this.secret=secret;}
  async accept(id:string,binding:SessionBinding,requestId:string,payload:unknown){
    const hash=payloadHmac(this.secret,payload);
    return transaction(this.pool,async c=>{
      await activeSubject(c,binding.subject);
      await this.lockSubject(c,binding.subject);
      const {rows:[existing]}=await c.query(`SELECT state,payload_hmac,deadline,session_id,generation::text FROM ai_requests WHERE subject=$1 AND request_id=$2`,[binding.subject,requestId]);
      if(existing){
        if(existing.payload_hmac!==hash || existing.session_id!==id || existing.generation!==String(binding.generation))throw new AssistantError('AI_CONFLICT');
        await this.sessions.validate(c,id,binding);
        return {admitted:false,state:existing.state as string,deadline:existing.deadline as Date};
      }
      await this.sessions.validate(c,id,binding);
      const {rows:[subject]}=await c.query(`SELECT active_request_id FROM ai_subjects WHERE subject=$1`,[binding.subject]);
      if(subject.active_request_id)throw new AssistantError('AI_CONFLICT');
      const {rows:[clock]}=await c.query(`SELECT clock_timestamp() now,(clock_timestamp() AT TIME ZONE 'Europe/London')::date::text quota_date`);
      const limit=binding.subject.startsWith('user:')?50:10;
      await c.query(`INSERT INTO ai_quota(subject,london_date,minute_start) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[binding.subject,clock.quota_date,clock.now]);
      const {rows:[quota]}=await c.query(`SELECT *,minute_start<= $3::timestamptz-interval '60 seconds' reset_minute FROM ai_quota WHERE subject=$1 AND london_date=$2 FOR UPDATE`,[binding.subject,clock.quota_date,clock.now]);
      if(quota.successes+quota.reserved_success_slots>=limit || (!quota.reset_minute && quota.minute_count>=5))throw new AssistantError('AI_QUOTA_EXCEEDED');
      const deadline=new Date((clock.now as Date).getTime()+30_000);
      await c.query(`UPDATE ai_quota SET reserved_success_slots=reserved_success_slots+1,minute_count=CASE WHEN $3 THEN 1 ELSE minute_count+1 END,minute_start=CASE WHEN $3 THEN $4 ELSE minute_start END WHERE subject=$1 AND london_date=$2`,[binding.subject,clock.quota_date,quota.reset_minute,clock.now]);
      await c.query(`INSERT INTO ai_requests(subject,request_id,session_id,generation,payload_hmac,state,deadline,quota_date) VALUES($1,$2,$3,$4,$5,'PENDING',$6,$7)`,[binding.subject,requestId,id,binding.generation,hash,deadline,clock.quota_date]);
      await c.query(`UPDATE ai_subjects SET active_request_id=$2 WHERE subject=$1`,[binding.subject,requestId]);
      await c.query(`UPDATE ai_session_meta SET active_request_id=$2 WHERE id=$1`,[id,requestId]);
      return {admitted:true,state:'PENDING',deadline};
    });
  }
  async finish(subject:string,requestId:string,state:TerminalRequestState,errorCode:'TIMEOUT'|'UNAVAILABLE'|'SUPERSEDED'|'RESTART'|'INVALID_RESULT'|null=null,validateAndPublish?: (client:PoolClient)=>Promise<void>,prelockSources?:(client:PoolClient)=>Promise<void>){
    return transaction(this.pool,async c=>{
      // Source callback locks actor and public authors together in sorted user order.
      await prelockSources?.(c);
      // Lock even a deleting account before AI rows; invalidated work must still release quota.
      if(subject.startsWith('user:')){
        await c.query(`SELECT id FROM users WHERE id=$1 FOR SHARE`,[subject.slice(5)]);
        await c.query(`SELECT user_id FROM ai_preferences WHERE user_id=$1 FOR SHARE`,[subject.slice(5)]);
      }else if(subject.startsWith('guest:'))await c.query(`SELECT id FROM guest_sessions WHERE id=$1 FOR SHARE`,[subject.slice(6)]);
      await this.lockSubject(c,subject);
      const {rows:[request]}=await c.query(`SELECT *,deadline<=clock_timestamp() timed_out FROM ai_requests WHERE subject=$1 AND request_id=$2 FOR UPDATE`,[subject,requestId]);
      if(!request)throw new AssistantError('AI_CONFLICT');
      if(request.state!=='PENDING')return false;
      let final=state;
      if(request.timed_out){final='FAILED';errorCode='TIMEOUT';}
      if(final==='SUCCEEDED'||final==='NEEDS_INPUT'){
        const {rows:[session]}=await c.query(`SELECT status,generation::text,preference_epoch::text,privacy_epoch::text FROM ai_session_meta WHERE id=$1 FOR UPDATE`,[request.session_id]);
        let valid=session?.status==='ACTIVE'&&session.generation===String(request.generation);
        if(subject.startsWith('user:')){
          const {rows:[user]}=await c.query(`SELECT status FROM users WHERE id=$1`,[subject.slice(5)]);
          const {rows:[prefs]}=await c.query(`SELECT epoch::text FROM ai_preferences WHERE user_id=$1`,[subject.slice(5)]);
          valid=valid&&user?.status==='ACTIVE'&&session.preference_epoch===(prefs?.epoch??'0');
        }
        const {rows:[privacy]}=await c.query(`SELECT epoch::text FROM privacy_control WHERE id=1 FOR SHARE`);
        valid=valid&&session?.privacy_epoch===privacy?.epoch;
        if(!valid){final='SUPERSEDED';errorCode='SUPERSEDED';}
        else {
          if(!validateAndPublish)throw new AssistantError('AI_UNAVAILABLE');
          // Required callback validates RAM generation/TTL + source authorization before publishing.
          await validateAndPublish(c);
        }
      }
      const successful=final==='SUCCEEDED'||final==='NEEDS_INPUT';
      await c.query(`UPDATE ai_quota SET reserved_success_slots=reserved_success_slots-1,successes=successes+$3 WHERE subject=$1 AND london_date=$2`,[subject,request.quota_date,successful?1:0]);
      await c.query(`UPDATE ai_requests SET state=$3,error_code=$4,finished_at=clock_timestamp() WHERE subject=$1 AND request_id=$2`,[subject,requestId,final,errorCode]);
      await c.query(`UPDATE ai_subjects SET active_request_id=NULL WHERE subject=$1 AND active_request_id=$2`,[subject,requestId]);
      await c.query(`UPDATE ai_session_meta SET active_request_id=NULL WHERE id=$1 AND active_request_id=$2`,[request.session_id,requestId]);
      return true;
    });
  }
  async recoverAfterRestart(){
    const {rows}=await this.pool.query(`SELECT subject,request_id FROM ai_requests WHERE state='PENDING'`);
    for(const row of rows)await this.finish(row.subject,row.request_id,'FAILED','RESTART');
  }
  async expireDeadlines(){
    const {rows}=await this.pool.query(`SELECT subject,request_id FROM ai_requests WHERE state='PENDING' AND deadline<=clock_timestamp()`);
    for(const row of rows)await this.finish(row.subject,row.request_id,'FAILED','TIMEOUT');
  }
  private async lockSubject(c:PoolClient,subject:string){
    await c.query(`INSERT INTO ai_subjects(subject) VALUES($1) ON CONFLICT DO NOTHING`,[subject]);
    await c.query(`SELECT subject FROM ai_subjects WHERE subject=$1 FOR UPDATE`,[subject]);
  }
}
