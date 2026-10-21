/** Fixed clock for an explicitly enabled, brand-new disposable acceptance database only. */
import {createPool} from '../packages/db/src/index.ts';
import type {MigratedDatabase} from '../packages/testkit/src/db/index.ts';
import type {buildServer} from '../apps/api/src/http/server.ts';
type Api=Awaited<ReturnType<typeof buildServer>>;
const RealDate=globalThis.Date;
const WINDOW=30*86_400_000;
let installed=false;
const fail=()=>{throw new Error('Invalid local fixture clock configuration or command');};
export function parseClockInstant(value:unknown):number{
 if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return fail();
 const instant=RealDate.parse(value);if(!Number.isFinite(instant)||new RealDate(instant).toISOString()!==value)return fail();return instant;
}
export function parseClockCommand(line:string):string{
 if(line.length>200)return fail();let value:unknown;try{value=JSON.parse(line);}catch{return fail();}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).join(',')!=='advanceTo'||!('advanceTo' in value))return fail();
 parseClockInstant(value.advanceTo);return value.advanceTo as string;
}
export async function createLocalClock(db:MigratedDatabase,env:NodeJS.ProcessEnv){
 if(installed||env.FANCY_LOCAL_ACCEPTANCE!=='1'||env.FANCY_LOCAL_CLOCK!=='1'||env.FANCY_TEST_DATABASE_URL||(env.ENVIRONMENT&&env.ENVIRONMENT!=='development'))return fail();
 const url=new URL(db.url);const database=url.pathname.slice(1);
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/^fancy_test_[a-z0-9_]+$/.test(database)||url.searchParams.has('options'))return fail();
 const start=parseClockInstant(env.FANCY_LOCAL_CLOCK_START);
 if(start<RealDate.now()||start>RealDate.now()+WINDOW)return fail();
 const {rows:[state]}=await db.pool.query(`SELECT current_database() AS name,(SELECT count(*)::int FROM users) AS users,to_regnamespace('fancy_fixture_clock') AS prior`);
 if(state.name!==database||state.users!==0||state.prior!==null)return fail();
 await db.pool.query(`CREATE SCHEMA fancy_fixture_clock`);
 await db.pool.query(`CREATE TABLE fancy_fixture_clock.state(id integer PRIMARY KEY CHECK(id=1),instant timestamptz NOT NULL)`);
 await db.pool.query(`INSERT INTO fancy_fixture_clock.state VALUES(1,$1)`,[new RealDate(start).toISOString()]);
 for(const name of ['clock_timestamp','transaction_timestamp','statement_timestamp','now'])await db.pool.query(`CREATE FUNCTION fancy_fixture_clock.${name}() RETURNS timestamptz LANGUAGE sql ${name==='clock_timestamp'?'VOLATILE':'STABLE'} AS 'SELECT instant FROM fancy_fixture_clock.state WHERE id=1'`);
 // Existing defaults bind function OIDs during migration, so search_path alone is insufficient.
 const {rows:defaults}=await db.pool.query<{table_name:string;column_name:string;expression:string}>(`SELECT c.relname AS table_name,a.attname AS column_name,pg_get_expr(d.adbin,d.adrelid) AS expression FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=d.adnum WHERE n.nspname='public'`);
 const quote=(value:string)=>'"'+value.replaceAll('"','""')+'"';
 for(const row of defaults){
  const expression=row.expression.replace(/\b(?:pg_catalog\.)?(clock_timestamp|transaction_timestamp|statement_timestamp|now)\(\)/gi,(_,name:string)=>`fancy_fixture_clock.${name.toLowerCase()}()`).replace(/\bCURRENT_TIMESTAMP(?:\(\d+\))?/gi,'fancy_fixture_clock.transaction_timestamp()');
  if(expression!==row.expression)await db.pool.query(`ALTER TABLE public.${quote(row.table_name)} ALTER COLUMN ${quote(row.column_name)} SET DEFAULT ${expression}`);
 }
 url.searchParams.set('options','-c search_path=fancy_fixture_clock,pg_catalog,public');
 const pool=createPool(url.toString(),{max:20,application:'fancy-local-fixed-clock'});
 let instant=start,closed=false;
 globalThis.Date=new Proxy(RealDate,{
  construct(target,args,newTarget){return Reflect.construct(target,args.length?args:[instant],newTarget);},
  apply(){return new RealDate(instant).toString();},
  get(target,key,receiver){return key==='now'?()=>instant:Reflect.get(target,key,receiver);},
 });
 installed=true;
 return {
  pool,
  now:()=>new RealDate(instant).toISOString(),
  validateAdvanceTo(value:string){const next=parseClockInstant(value);if(closed||next<=instant||next>start+WINDOW)return fail();return next;},
  async advanceTo(value:string){
   const next=parseClockInstant(value);if(closed||next<=instant||next>start+WINDOW)return fail();
   const client=await pool.connect();
   try{await client.query('BEGIN');await client.query(`UPDATE fancy_fixture_clock.state SET instant=$1 WHERE id=1`,[value]);await client.query('COMMIT');instant=next;}catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
  },
  async close(){if(closed)return;closed=true;globalThis.Date=RealDate;installed=false;await pool.end();},
 };
}

/** Block new work before draining old requests; never change production request semantics. */
export function localClockGate(app:Api,drainTimeoutMs=10_000){
 let paused=false;const active=new Set<object>();let drained:(()=>void)|null=null;
 app.addHook('onRequest',async(request,reply)=>{if(paused)return reply.code(503).send({fixtureClockPaused:true});active.add(request);});
 const finish=(request:object)=>{active.delete(request);if(active.size===0)drained?.();};
 app.addHook('onResponse',async request=>finish(request));
 app.addHook('onRequestAbort',async request=>finish(request));
 return {
  async pause(){paused=true;if(active.size)await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{drained=null;reject(new Error('Local clock request drain timed out'));},drainTimeoutMs);drained=()=>{clearTimeout(timer);resolve();};});drained=null;},
  block(){paused=true;},
  resume(){paused=false;},
 };
}
export type LocalClock=Awaited<ReturnType<typeof createLocalClock>>;


/** Caller treats any error after this transition begins as fatal and closes the rig. */
export async function advanceRigClock(clock:LocalClock,gate:ReturnType<typeof localClockGate>,worker:{stop:()=>Promise<unknown>;tick:()=>Promise<unknown>;start:()=>void},value:string,timeoutMs=10_000){
 clock.validateAdvanceTo(value);
 async function bounded(job:Promise<unknown>){
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([job,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Local clock worker timed out')),timeoutMs);})]);}finally{clearTimeout(timer);}
 }
 try{
  await gate.pause();await bounded(worker.stop());await clock.advanceTo(value);await bounded(worker.tick());worker.start();gate.resume();
 }catch(error){gate.block();throw error;}
}
