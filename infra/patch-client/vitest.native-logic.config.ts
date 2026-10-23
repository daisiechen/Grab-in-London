/** Pure iOS feature logic probe: use the repository TypeScript baseline, without Expo/Jest UI transforms. */
import {resolve} from 'node:path';
import {defineConfig} from 'vitest/config';
const root=resolve(import.meta.dirname,'../..');
export default defineConfig({root,tsconfig:resolve(root,'tsconfig.base.json'),test:{include:['infra/patch-client/profile-conflict-late.acceptance.test.ts']}});
