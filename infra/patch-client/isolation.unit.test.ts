import {describe,it,expect} from 'vitest';
import {assertPatchEnvironment,within} from './isolation.ts';
const env={FANCY_PATCH_CLIENT:'P1.1',TMPDIR:'/private/tmp/fancy-p11-client-test'};
describe('P1.1 rig isolation',()=>{
 it('requires explicit opt-in and an owned temp root',()=>{expect(()=>assertPatchEnvironment(env,'/worktrees/patch')).not.toThrow();expect(()=>assertPatchEnvironment({...env,TMPDIR:'/tmp/shared'},'/worktrees/patch')).toThrow('PATCH_TEMP_ROOT_REQUIRED');expect(()=>assertPatchEnvironment({},'/worktrees/patch')).toThrow();});
 it.each(['DATABASE_URL','FANCY_TEST_DATABASE_URL','FANCY_TEST_DB_ALLOW_REMOTE','AI_BUNDLE_FILE','DEEPSEEK_API_KEY','RESEND_API_KEY','AUTH0_CLIENT_SECRET'])('refuses inherited %s',key=>{expect(()=>assertPatchEnvironment({...env,[key]:'configured'},'/worktrees/patch')).toThrow('PATCH_INHERITED_CONFIG_REFUSED');});
 it('rejects path-prefix lookalikes',()=>{expect(within('/work/patch','/work/patch-old/node_modules')).toBe(false);expect(within('/work/patch','/work/patch/node_modules')).toBe(true);});
});
