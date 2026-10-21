/** QA-PRIVACY-003: non-silent production logger pipeline and actual failure/receipt flow in an isolated API child. */
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {migrate} from '../packages/db/src/index.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../packages/testkit/src/db/index.ts';
import {withTransaction} from '../apps/api/src/common/transaction.ts';
import {issueNativeCredentials} from '../apps/api/src/identity/sessions.ts';
let db:MigratedDatabase;beforeAll(async()=>{db=await createMigratedDatabase(inject('pgServerUrl'),migrate);});afterAll(async()=>db?.drop());
it('QA-PRIVACY-003 real fault500 rollback then lost202 receipt survives session revocation without receipt/access secrets in logs or URLs',async()=>{
 const userId=randomUUID(),receiptToken=randomBytes(32).toString('base64url');await db.pool.query('INSERT INTO users(id) VALUES($1)',[userId]);
 const issued=await withTransaction(db.pool,tx=>issueNativeCredentials(tx.client,userId,'IOS',['otp'],new Date()));
 const child=fork(new URL('./qa-deletion-log-child.ts',import.meta.url),[],{execArgv:['--experimental-strip-types','--experimental-transform-types'],env:{...process.env,NODE_NO_WARNINGS:'1'},stdio:['ignore','pipe','pipe','ipc']});
 const logs:string[]=[],messages:Record<string,unknown>[]=[],errors:string[]=[];child.stdout?.on('data',c=>logs.push(String(c)));child.stderr?.on('data',c=>errors.push(String(c)));child.on('message',m=>messages.push(m as Record<string,unknown>));
 const done=once(child,'exit');try{
  child.send({url:db.url,accessToken:issued.credentials.accessToken,receiptToken,userId});
  const [code]=await done;expect(code,errors.join('').split('\n')[0]).toBe(0);
  const result=messages.find(m=>m.event==='done');expect(result).toEqual({event:'done',failed:500,intact:'ACTIVE',stillSignedIn:200,accepted:202,revoked:401,receipt:200,fields:['completedAt','requestedAt','status'],receiptContainsToken:false});
  const lines=logs.join('').split('\n').filter(Boolean).map(line=>JSON.parse(line) as {req?:{url?:string};msg?:string});expect(lines.length).toBeGreaterThan(0);
  expect(lines.some(l=>l.req?.url==='/v1/deletion-status')).toBe(true);expect(lines.some(l=>l.msg==='unexpected error')).toBe(true);
  const raw=logs.join('');for(const secret of[receiptToken,issued.credentials.accessToken])expect(raw.includes(secret)).toBe(false);
  const urls=lines.flatMap(l=>l.req?.url?[l.req.url]:[]);expect(urls.every(url=>!url.includes('?'))).toBe(true);
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await done;}}
});
