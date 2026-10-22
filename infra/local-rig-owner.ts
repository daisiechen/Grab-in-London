/** Private ownership receipt. Preservation is not a quiescent database snapshot. */
import {readFile,writeFile,lstat,realpath,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createPool} from '../packages/db/src/index.ts';
import type {PostgresOwnership,PostgresServer} from '../packages/testkit/src/postgres/server.ts';
const run=promisify(execFile);
const refuse=()=>{throw new Error('OWN_CLEANUP_REFUSED');};
export async function writeRigReceipt(server:PostgresServer,database?:string){
 const owner=server.ownership;if(!owner)return refuse();
 const path=join(owner.root,'rig-receipt.json');
 await writeFile(path,JSON.stringify({kind:'LOCAL_RIG_OWNER',owner,database:database??null,shutdownBoundary:'app.close may write AI recovery metadata; active work may remain; preservation is not a sealed snapshot'}),{mode:0o600});
 return path;
}
export async function cleanupOwnedRig(path:string,expectedOwner:string){
 const stat=await lstat(path);if(stat.isSymbolicLink()||!stat.isFile()||(stat.mode&0o777)!==0o600||stat.uid!==process.getuid?.())return refuse();
 const receipt=JSON.parse(await readFile(path,'utf8')) as {kind?:string;owner?:PostgresOwnership};
 const o=receipt.owner;if(receipt.kind!=='LOCAL_RIG_OWNER'||!o||o.id!==expectedOwner||!/^[a-f0-9]{48}$/.test(o.id))return refuse();
 const temporary=await realpath(tmpdir());
 if(dirname(o.root)!==temporary||!o.root.startsWith(join(temporary,'fancy-pg-'))||await realpath(o.root)!==o.root||await realpath(path)!==join(o.root,'rig-receipt.json')||o.data!==join(o.root,'data')||o.marker!==join(o.root,'fancy-owner.json'))return refuse();
 for(const candidate of [o.root,o.data,o.marker,o.bin])if((await lstat(candidate)).isSymbolicLink())return refuse();
 const marker=await lstat(o.marker);if((marker.mode&0o777)!==0o600||marker.uid!==stat.uid||await readFile(o.marker,'utf8')!==JSON.stringify(o))return refuse();
 const pid=(await readFile(join(o.data,'postmaster.pid'),'utf8')).split('\n');
 if(Number(pid[0])!==o.pid||Number(pid[3])!==o.port||await realpath(pid[1]!)!==o.data||!Number.isInteger(o.pid)||o.pid<=1||!Number.isInteger(o.port)||o.port<1024||o.port>65535)return refuse();
 const pool=createPool(`postgres://fancy@127.0.0.1:${o.port}/postgres`);
 try{const {rows:[live]}=await pool.query(`SELECT current_setting('data_directory') AS directory,current_setting('port')::integer AS port`);if(!live||await realpath(live.directory)!==o.data||live.port!==o.port)return refuse();}finally{await pool.end();}
 try{await run(join(o.bin,'pg_ctl'),['-D',o.data,'-m','fast','-w','stop']);}catch{throw new Error('OWN_CLEANUP_STOP_FAILED_DATA_PRESERVED');}
 await rm(o.root,{recursive:true});
}
