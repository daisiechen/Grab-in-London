import {isAbsolute,relative,resolve} from 'node:path';
/** Positive allowlist environment; external DBs, QA clocks and providers are never accepted. */
export function assertAdminEnvironment(env:NodeJS.ProcessEnv){
 for(const key of Object.keys(env))if(!['PATH','HOME','TMPDIR','FANCY_PG_BIN','ADMIN_PATCH_ROOT','ADMIN_PATCH_RUNTIME','FANCY_API_ORIGIN','NODE_COMPILE_CACHE','__CF_USER_TEXT_ENCODING'].includes(key))throw new Error(`ADMIN_ENV_KEY_REFUSED:${key}`);
 const root=env.ADMIN_PATCH_ROOT,runtime=env.ADMIN_PATCH_RUNTIME;
 if(!root||!runtime||!isAbsolute(root)||resolve(runtime)!==runtime||!runtime.startsWith(root+'/dist/admin-patch/run-'))throw new Error('ADMIN_RUNTIME_ROOT_REQUIRED');
 if(env.TMPDIR!==runtime+'/tmp'||relative(root,runtime).startsWith('..'))throw new Error('ADMIN_TMP_REQUIRED');
 if(env.FANCY_API_ORIGIN!=='http://127.0.0.1:64276')throw new Error('ADMIN_API_ORIGIN_REQUIRED');
 if(!env.FANCY_PG_BIN||!isAbsolute(env.FANCY_PG_BIN))throw new Error('ADMIN_PG_BIN_REQUIRED');
 return {root,runtime,origin:'http://p11-admin.localhost:64275',apiPort:64276,adminPort:64275};
}
