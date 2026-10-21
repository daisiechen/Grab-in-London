/** QA-CODE-006: inspect the actual non-silent log stream for valid callback credentials, not just headers. */
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {migrate} from '../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../packages/testkit/src/db/index.ts';
let db:MigratedDatabase;beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>db?.drop());
it('QA-F13 a real successful OAuth callback does not put its code state or private email in the actual log stream',async()=>{
 const child=fork(new URL('./qa-oauth-log-child.ts',import.meta.url),[],{execArgv:['--experimental-strip-types','--experimental-transform-types'],env:{...process.env,NODE_NO_WARNINGS:'1'},stdio:['ignore','pipe','pipe','ipc']});
 const logs:string[]=[],errors:string[]=[],messages:Record<string,unknown>[]=[];child.stdout?.on('data',c=>logs.push(String(c)));child.stderr?.on('data',c=>errors.push(String(c)));child.on('message',m=>messages.push(m as Record<string,unknown>));
 const done=once(child,'exit');try{
  child.send({url:db.url});const[code]=await done;expect(code,errors.join('').split('\n')[0]).toBe(0);const result=messages.find(m=>m.event==='done');expect(result?.status).toBe(200);
  const raw=logs.join('');expect(raw).toContain('/v1/auth/oauth/callback');expect({code:raw.includes(String(result?.code)),state:raw.includes(String(result?.state)),email:raw.includes(String(result?.email))}).toEqual({code:false,state:false,email:false});
  const lines=raw.split('\n').filter(Boolean).map(line=>JSON.parse(line) as {req?:{url?:string};reqId?:string;responseTime?:number});
  expect(lines.some(line=>typeof line.reqId==='string'&&line.reqId.length>0)).toBe(true);expect(lines.some(line=>typeof line.responseTime==='number')).toBe(true);expect(lines.some(line=>line.req?.url==='/v1/auth/oauth/callback')).toBe(true);
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await done;}}
});
