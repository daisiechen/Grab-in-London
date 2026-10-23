/** Dedicated PATCH-006 process boundary: never inherit credentials, databases or clocks. */
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

const root=await realpath(fileURLToPath(new URL('../..',import.meta.url)));
const branch=execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim();
if(branch!=='codex/admin-patch-p11')throw new Error('ADMIN_PATCH_BRANCH_REQUIRED');
const output=join(root,'dist','admin-patch');
await mkdir(output,{recursive:true,mode:0o700});
const runtime=await mkdtemp(join(output,'run-'));
const temp=join(runtime,'tmp');await mkdir(temp,{mode:0o700});
const pgBin=process.env.ADMIN_PATCH_PG_BIN;
if(!pgBin||!resolve(pgBin).startsWith('/'))throw new Error('ADMIN_PATCH_PG_BIN_REQUIRED');
const args=process.argv.slice(2);
const testing=args[0]==='--test';
const built=args.length===1&&args[0]==='--built';
if(args.length&&!testing&&!built)throw new Error('ADMIN_PATCH_ARGUMENT_REFUSED');
const command=testing?'pnpm':process.execPath;
const childArgs=testing?['exec','vitest','run',...args.slice(1)]:['--experimental-transform-types',join(root,'infra/admin-patch/runtime.ts')];
const child=spawn(command,childArgs,{
 cwd:root,stdio:'inherit',env:{PATH:process.env.PATH??'/usr/bin:/bin',HOME:process.env.HOME,
 TMPDIR:temp,FANCY_PG_BIN:await realpath(pgBin),ADMIN_PATCH_ROOT:root,ADMIN_PATCH_RUNTIME:runtime,
 ADMIN_PATCH_MODE:built?'built':'dev',FANCY_API_ORIGIN:'http://127.0.0.1:64276'},
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>{process.exitCode=code??1;});
