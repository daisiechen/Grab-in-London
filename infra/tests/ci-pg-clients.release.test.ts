import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {expect,it} from 'vitest';
const run=promisify(execFile);
it('pinned CI backup client wrappers preserve pg_dump arguments and shared temporary backup paths',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fancy-ci-clients-'));
 try{
  const bin=join(dir,'clients'),log=join(dir,'args.json');
  await writeFile(join(dir,'docker'),`#!/bin/sh\nprintf '%s\\n' "$@" > "$FANCY_CLIENT_ARGS"\n`,{mode:0o700});
  const env={...process.env,FANCY_CI_CLIENT_DIR:bin,FANCY_CLIENT_ARGS:log,PATH:`${dir}:${process.env.PATH}`};
  await run('sh',['infra/scripts/ci-pg-clients.sh'],{env});
  for(const client of ['pg_dump','pg_restore']){
   await run(join(bin,client),['--dbname','postgres://fixture@127.0.0.1:55417/test','--file','/tmp/file with space.dump'],{env});
   expect((await readFile(log,'utf8')).trim().split('\n')).toEqual(['run','--rm','--network','host','--volume','/tmp:/tmp','postgres:17.11-bookworm',client,'--dbname','postgres://fixture@127.0.0.1:55417/test','--file','/tmp/file with space.dump']);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
