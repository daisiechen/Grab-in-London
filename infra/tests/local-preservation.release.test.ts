import {it,expect} from 'vitest';
import {readFile,lstat,symlink,unlink,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPool} from '../../packages/db/src/index.ts';
import {startPostgres17,createIsolatedDatabase} from '../../packages/testkit/src/postgres/server.ts';
import {preserveLocalRig} from '../local-acceptance.ts';
import {writeRigReceipt,cleanupOwnedRig} from '../local-rig-owner.ts';
// Ownership proofs must never select the shared service, even when CI supplies it.
function ownedEnv():NodeJS.ProcessEnv{return {...process.env,FANCY_TEST_DATABASE_URL:undefined,FANCY_PG_BIN:process.env.FANCY_OWNED_PG_BIN??process.env.FANCY_PG_BIN};}
it('preserves a fresh database after clients close; only explicit matching ownership destroys it',async()=>{
 const server=await startPostgres17(ownedEnv());let cleaned=false;
 try{
  const db=await createIsolatedDatabase(server.url),client=createPool(db.url);
  await client.query('CREATE TABLE preservation_proof(id integer PRIMARY KEY)');await client.query('INSERT INTO preservation_proof VALUES(47)');await expect(preserveLocalRig({closeApp:async()=>{throw new Error('controlled shutdown failure');},closeClock:async()=>{},closePool:()=>client.end()})).rejects.toThrow('controlled shutdown failure');
  const receipt=await writeRigReceipt(server,db.name),owner=server.ownership!;
  expect((await lstat(receipt)).mode&0o777).toBe(0o600);expect(await readFile(receipt,'utf8')).not.toContain('postgres://');
  await expect(cleanupOwnedRig(receipt,'wrong')).rejects.toThrow('OWN_CLEANUP_REFUSED');
  const link=join(owner.root,'receipt-link');await symlink(receipt,link);await expect(cleanupOwnedRig(link,owner.id)).rejects.toThrow('OWN_CLEANUP_REFUSED');await unlink(link);
  const verify=createPool(db.url);expect((await verify.query('SELECT id FROM preservation_proof')).rows).toEqual([{id:47}]);await verify.end();
  await cleanupOwnedRig(receipt,owner.id);cleaned=true;await expect(lstat(owner.root)).rejects.toThrow();
 }finally{if(!cleaned)await server.stop();}
},60_000);

it('a failed owned pg_ctl stop keeps the running server and cluster directory',async()=>{
 const env=ownedEnv(),bin=env.FANCY_PG_BIN;if(!bin)throw new Error('Own PostgreSQL binary required');
 const wrapper=await mkdtemp(join(tmpdir(),'fancy-stop-proof-'));
 for(const name of ['postgres','initdb','pg_ctl'])await symlink(join(bin,name),join(wrapper,name));
 let server:Awaited<ReturnType<typeof startPostgres17>>|undefined;
 try{
  server=await startPostgres17({...env,FANCY_PG_BIN:wrapper});
  await unlink(join(wrapper,'pg_ctl'));await writeFile(join(wrapper,'pg_ctl'),`#!${process.execPath}\nprocess.exit(1);\n`,{mode:0o700});
  await expect(server.stop()).rejects.toThrow('OWNED_POSTGRES_STOP_FAILED_DATA_PRESERVED');
  expect((await lstat(server.ownership!.data)).isDirectory()).toBe(true);
  const pool=createPool(server.url);try{expect((await pool.query('SELECT 47 AS proof')).rows).toEqual([{proof:47}]);}finally{await pool.end();}
 }finally{
  await unlink(join(wrapper,'pg_ctl')).catch(()=>undefined);await symlink(join(bin,'pg_ctl'),join(wrapper,'pg_ctl'));await server?.stop();await rm(wrapper,{recursive:true});
 }
},60_000);
