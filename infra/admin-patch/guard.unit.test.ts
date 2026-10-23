import {describe,expect,it} from 'vitest';
import {assertAdminEnvironment} from './guard.ts';
const env={ADMIN_PATCH_ROOT:'/isolated/admin',ADMIN_PATCH_RUNTIME:'/isolated/admin/dist/admin-patch/run-fixture',TMPDIR:'/isolated/admin/dist/admin-patch/run-fixture/tmp',FANCY_PG_BIN:'/immutable/pg17',FANCY_API_ORIGIN:'http://127.0.0.1:64276'};
describe('PATCH006 environment boundary',()=>{
 it('accepts only a dedicated runtime and temporary root',()=>expect(assertAdminEnvironment(env).adminPort).toBe(64275));
 for(const key of ['DATABASE_URL','FANCY_TEST_DATABASE_URL','FANCY_TEST_DB_ALLOW_REMOTE','FANCY_LOCAL_CLOCK','SESSION_SECRET','AUTH0_CLIENT_SECRET','DEEPSEEK_API_KEY','RESEND_API_KEY'])it(`refuses inherited ${key}`,()=>expect(()=>assertAdminEnvironment({...env,[key]:'inherited'})).toThrow('ADMIN_ENV_KEY_REFUSED'));
 it('rejects old origins and outputs outside the root',()=>{
  expect(()=>assertAdminEnvironment({...env,FANCY_API_ORIGIN:'http://127.0.0.1:3000'})).toThrow('ADMIN_API_ORIGIN_REQUIRED');
  expect(()=>assertAdminEnvironment({...env,ADMIN_PATCH_RUNTIME:'/other/root'})).toThrow('ADMIN_RUNTIME_ROOT_REQUIRED');
  expect(()=>assertAdminEnvironment({...env,ADMIN_PATCH_RUNTIME:env.ADMIN_PATCH_RUNTIME+'/../../escape',TMPDIR:env.ADMIN_PATCH_RUNTIME+'/../../escape/tmp'})).toThrow('ADMIN_RUNTIME_ROOT_REQUIRED');
  expect(()=>assertAdminEnvironment({...env,TMPDIR:'/private/tmp'})).toThrow('ADMIN_TMP_REQUIRED');
 });
});

it('built mode is explicit and refuses unrecognized modes',()=>{expect(assertAdminEnvironment({...env,ADMIN_PATCH_MODE:'built'}).built).toBe(true);expect(assertAdminEnvironment(env).built).toBe(false);expect(()=>assertAdminEnvironment({...env,ADMIN_PATCH_MODE:'production'})).toThrow('ADMIN_MODE_REFUSED');});
