import {realpath} from 'node:fs/promises';
import {isAbsolute,relative,resolve} from 'node:path';

export function within(root:string,path:string){const rel=relative(root,path);return rel===''||(!rel.startsWith('..')&&!isAbsolute(rel));}
/** Refuse inherited connection settings; this rig creates its own cluster and secret. */
export function assertPatchEnvironment(env:NodeJS.ProcessEnv,root:string){
 if(env.FANCY_PATCH_CLIENT!=='P1.1')throw new Error('PATCH_CLIENT_OPT_IN_REQUIRED');
 for(const key of ['DATABASE_URL','FANCY_TEST_DATABASE_URL','FANCY_TEST_DB_ALLOW_REMOTE','AI_BUNDLE_FILE','DEEPSEEK_API_KEY','RESEND_API_KEY','AUTH0_CLIENT_SECRET'])if(env[key])throw new Error(`PATCH_INHERITED_CONFIG_REFUSED:${key}`);
 if(!env.TMPDIR||!isAbsolute(env.TMPDIR)||!resolve(env.TMPDIR).startsWith('/private/tmp/fancy-p11-client-'))throw new Error('PATCH_TEMP_ROOT_REQUIRED');
 if(root.includes('/Desktop/'))throw new Error('PATCH_MANAGED_WORKTREE_REQUIRED');
}
export async function assertDependencyIsolation(root:string){
 const canonical=await realpath(root);
 for(const name of ['node_modules/typescript','node_modules/vitest','apps/web/node_modules/react','apps/ios/node_modules/react','apps/web/node_modules/@fancy/client']){
  if(!within(canonical,await realpath(resolve(root,name))))throw new Error('PATCH_DEPENDENCY_OUTSIDE_ROOT');
 }
}
