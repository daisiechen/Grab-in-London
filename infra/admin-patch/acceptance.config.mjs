import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';
const require=createRequire(new URL('../../apps/admin/package.json',import.meta.url));
export default defineConfig({
 resolve:{alias:[{find:/^react$/,replacement:require.resolve('react')},{find:'react/jsx-dev-runtime',replacement:require.resolve('react/jsx-dev-runtime')},{find:'react/jsx-runtime',replacement:require.resolve('react/jsx-runtime')},{find:'@testing-library/react',replacement:require.resolve('@testing-library/react')},{find:'@testing-library/user-event',replacement:require.resolve('@testing-library/user-event')}]},
 test:{environment:'jsdom',include:['infra/admin-patch/*.acceptance.test.ts'],setupFiles:[fileURLToPath(new URL('../../apps/admin/src/test/setup.ts',import.meta.url))],restoreMocks:true,unstubGlobals:true},
});
