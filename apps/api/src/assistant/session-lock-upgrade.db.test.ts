import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it,vi} from 'vitest';
import {migrate} from '../../../../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../../../../packages/testkit/src/db/index.ts';
import {AssistantRuntime,type SessionBinding} from '../../../../packages/assistant/src/index.ts';
import {SessionService} from './sessions.ts';
let db:MigratedDatabase;
beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});
afterAll(async()=>db.drop());
it.each(['activity','reset'] as const)('serializes activity/%s before acquiring metadata write authority',async(second)=>{
 const user=randomUUID();await db.pool.query('INSERT INTO users(id) VALUES($1)',[user]);
 const runtime=new AssistantRuntime(),sessions=new SessionService(db.pool,runtime),subject=`user:${user}`,s=await sessions.create(subject);
 const binding:SessionBinding={subject,deviceToken:s.deviceToken,generation:1,preferenceEpoch:'0'};
 const original=sessions.validate.bind(sessions);let firstArrived!:()=>void,release!:()=>void;
 const arrived=new Promise<void>(r=>{firstArrived=r;}),gate=new Promise<void>(r=>{release=r;});let calls=0;
 const pids=new Set<number>();
 const spy=vi.spyOn(sessions,'validate').mockImplementation(async(...args)=>{
  await original(...args);pids.add((await args[0].query('SELECT pg_backend_pid() pid')).rows[0].pid);
  if(++calls===1){firstArrived();await gate;}
 });
 let a:Promise<unknown>|undefined,b:Promise<unknown>|undefined;
 try{
  a=sessions.activity(s.id,binding,randomUUID(),'EXPLICIT_ACTION');await arrived;
  b=second==='activity'?sessions.activity(s.id,binding,randomUUID(),'EXPLICIT_ACTION'):sessions.reset(s.id,binding);
  // Attach rejection handlers immediately; SQL is real, only the first transaction is paused.
  const results=Promise.allSettled([a,b]);let waiting=false;
  for(let n=0;n<150;n++){
   const {rows}=await db.pool.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%ai_session_meta%FOR UPDATE%'`);
   if(rows.length){waiting=true;break;}await new Promise(r=>setTimeout(r,5));
  }
  expect(waiting).toBe(true);release();
  expect((await results).map(r=>r.status==='fulfilled'?'OK':(r.reason as {code?:string}).code)).toEqual(['OK','OK']);
  expect(pids.size).toBe(2);
 }finally{release();await Promise.allSettled([a,b].filter((p):p is Promise<unknown>=>!!p));spy.mockRestore();runtime.shutdown();}
});

it('keeps two read-only validations concurrent under shared metadata locks',async()=>{
 const user=randomUUID();await db.pool.query('INSERT INTO users(id) VALUES($1)',[user]);
 const runtime=new AssistantRuntime(),sessions=new SessionService(db.pool,runtime),subject=`user:${user}`,s=await sessions.create(subject);
 const binding:SessionBinding={subject,deviceToken:s.deviceToken,generation:1,preferenceEpoch:'0'};
 const original=sessions.validate.bind(sessions);let release!:()=>void,arrived!:()=>void;
 const gate=new Promise<void>(r=>{release=r;}),first=new Promise<void>(r=>{arrived=r;});let count=0;
 const spy=vi.spyOn(sessions,'validate').mockImplementation(async(...args)=>{await original(...args);if(++count===1){arrived();await gate;}});
 let pending:Promise<unknown>|undefined;
 try{pending=sessions.read(s.id,binding);await first;expect(await sessions.read(s.id,binding)).toMatchObject({messages:[]});}
 finally{release();await pending;spy.mockRestore();runtime.shutdown();}
});
