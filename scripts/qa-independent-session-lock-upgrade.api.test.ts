/** Force both real PG transactions past validation with SHARE locks before either update. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it,vi} from 'vitest';
import {migrate} from '../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {AssistantRuntime,type SessionBinding} from '../packages/assistant/src/index.ts';
import {SessionService} from '../apps/api/src/assistant/sessions.ts';
let db:MigratedDatabase;beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>db.drop());
it('QA-CODE-003 QA-CODE-007 two same-session activities do not deadlock on validated SHARE to UPDATE conversion',async()=>{
 const user=randomUUID();await db.pool.query('INSERT INTO users(id) VALUES($1)',[user]);const runtime=new AssistantRuntime(),sessions=new SessionService(db.pool,runtime),subject=`user:${user}`,s=await sessions.create(subject),binding:SessionBinding={subject,deviceToken:s.deviceToken,generation:1,preferenceEpoch:'0'};
 const original=sessions.validate.bind(sessions),backends=new Set<number>();let arrived=0,release:()=>void=()=>{};const gate=new Promise<void>(r=>{release=r;});
 let firstValidated:()=>void=()=>{};const firstReady=new Promise<void>(r=>{firstValidated=r;});
 const spy=vi.spyOn(sessions,'validate').mockImplementation(async(c,id,b,mode)=>{backends.add((await c.query('SELECT pg_backend_pid() pid')).rows[0].pid);await original(c,id,b,mode);if(++arrived===1){firstValidated();await gate;}});
 try{
  const first=sessions.activity(s.id,binding,randomUUID(),'EXPLICIT_ACTION');await firstReady;
  const second=sessions.activity(s.id,binding,randomUUID(),'EXPLICIT_ACTION');
  let waiting=false;for(let i=0;i<200;i++){const r=await db.pool.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM ai_session_meta WHERE id=$1 FOR UPDATE%'");if(r.rows[0].n===1){waiting=true;break;}await new Promise<void>(r=>setTimeout(r,5));}
  release();const results=await Promise.allSettled([first,second]);expect(waiting).toBe(true);expect(backends.size).toBe(2);expect(arrived).toBe(2);
  const outcomes=results.map(r=>r.status==='fulfilled'?'OK':{code:r.reason.code,message:r.reason.message});expect(outcomes).toEqual(['OK','OK']);
 }finally{release();spy.mockRestore();runtime.shutdown();}
});
