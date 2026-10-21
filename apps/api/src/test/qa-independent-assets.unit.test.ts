/** QA-CODE-001/005: runtime fixture guards, production import boundaries and isolated generated-contract drift. */
import {expect,it} from 'vitest';
import {readFileSync,readdirSync,mkdirSync,cpSync,copyFileSync,symlinkSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,resolve,join,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
import {loadConfig} from '../../../../packages/config/src/index.ts';
import {FixturePlacesProvider} from '../venues/fixture-provider.ts';
import {TestIdentityProvider} from '../identity/test-provider.ts';
const ROOT=resolve(import.meta.dirname,'../../../..');
const production={ENVIRONMENT:'production',DATABASE_URL:'postgres://synthetic:placeholder@db.example.invalid/fancy?sslmode=verify-full',AUTH_ADAPTER:'auth0',PLACES_ADAPTER:'google',MAIL_ADAPTER:'provider',AI_PROVIDER:'disabled',WEB_ORIGIN:'https://app.example.invalid',SESSION_SECRET:'synthetic-config-review-secret-0123456789',AUTH0_DOMAIN:'tenant.example.invalid',AUTH0_CLIENT_ID:'synthetic-client',AUTH0_CLIENT_SECRET:'synthetic-only-placeholder',PRIVACY_POLICY_VERSION:'synthetic-not-approval',RETENTION_POLICY_JSON:'{"deletedAccountDays":30}'};
it('QA-CODE-001 staging and production reject each test adapter and fixed OTP without connecting any provider',()=>{
 expect(loadConfig(production).environment).toBe('production');
 for(const environment of['production','staging'])for(const[key,value]of[['AUTH_ADAPTER','test'],['PLACES_ADAPTER','fixture'],['MAIL_ADAPTER','outbox_test'],['AI_PROVIDER','mock'],['DEV_FIXED_OTP','123456']])expect(()=>loadConfig({...production,ENVIRONMENT:environment,[key!]:value})).toThrow();
 expect(()=>new FixturePlacesProvider('production')).toThrow();expect(()=>new TestIdentityProvider('production')).toThrow();
});
function sourceFiles(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
 if(['node_modules','test','__tests__','__mocks__','generated','.expo','dist'].includes(entry.name))return[];const file=join(dir,entry.name);
 if(entry.isDirectory())return sourceFiles(file);
 return /\.tsx?$/.test(file)&&!/(\.test|\.spec)\.[^.]+$/.test(file)?[file]:[];
});}
it('QA-CODE-001 current production app import graph never depends on the legacy Demo/shared/admin prototype or mock keyboard/payment module',()=>{
 const dirs=['apps/api/src','apps/web/src','apps/admin/src','apps/ios/src','apps/worker/src','apps/support-cli/src'];dirs.push(...readdirSync(join(ROOT,'packages'),{withFileTypes:true}).filter(d=>d.isDirectory()&&d.name!=='testkit').map(d=>`packages/${d.name}/src`));const files=dirs.flatMap(d=>sourceFiles(join(ROOT,d)));expect(files.length).toBeGreaterThan(0);
 let imports=0;const forbidden:string[]=[];
 for(const file of files){const tree=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const check=(value:string)=>{imports++;if(value.startsWith('.')){const target=relative(ROOT,resolve(dirname(file),value));if(/^(demo|shared|admin)(\/|$)/.test(target))forbidden.push(relative(ROOT,file)+':'+value);}if(/MockKeyboard|simulatePayment|\/Prototype(?:\.|$)/.test(value))forbidden.push(relative(ROOT,file)+':'+value);};
  const visit=(node:ts.Node)=>{if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))check(node.moduleSpecifier.text);
   if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))check(node.arguments[0].text);
   ts.forEachChild(node,visit);
  };visit(tree);
 }
 expect(imports).toBeGreaterThan(0);expect(forbidden).toEqual([]);
});
it('QA-CODE-005 isolated semantic OpenAPI and SDK metadata drift both fail the real checker; restore passes without touching workspace artifacts',()=>{
 const temporary=mkdtempSync(join(tmpdir(),'fancy-contract-drift-')),contracts=join(temporary,'packages/contracts'),client=join(temporary,'packages/client/src/generated');
 const paths=['packages/contracts/generated/openapi.json','packages/client/src/generated/operations.ts'],originals=paths.map(p=>readFileSync(join(ROOT,p)));
 try{
  mkdirSync(contracts,{recursive:true});cpSync(join(ROOT,'packages/contracts/src'),join(contracts,'src'),{recursive:true});copyFileSync(join(ROOT,'packages/contracts/package.json'),join(contracts,'package.json'));symlinkSync(join(ROOT,'packages/contracts/node_modules'),join(contracts,'node_modules'),'dir');
  mkdirSync(join(contracts,'generated'),{recursive:true});mkdirSync(client,{recursive:true});for(const[index,path]of paths.entries())writeFileSync(join(temporary,path),originals[index]!);
  const check=()=>spawnSync(process.execPath,['--experimental-strip-types','--experimental-transform-types',join(contracts,'src/generate.ts'),'--check'],{cwd:temporary,encoding:'utf8',env:{...process.env,NODE_NO_WARNINGS:'1'}});
  const initial=check();expect(initial.status,initial.stderr).toBe(0);
  const schema=JSON.parse(originals[0]!.toString());const first=Object.keys(schema.paths)[0]!;delete schema.paths[first];writeFileSync(join(temporary,paths[0]!),JSON.stringify(schema));
  const badOpenApi=check();expect(badOpenApi.status).toBe(1);expect(badOpenApi.stderr).toContain(paths[0]);writeFileSync(join(temporary,paths[0]!),originals[0]!);
  const metadata=originals[1]!.toString().replace("method: 'POST'","method: 'GET'");expect(metadata).not.toBe(originals[1]!.toString());writeFileSync(join(temporary,paths[1]!),metadata);
  const badSdk=check();expect(badSdk.status).toBe(1);expect(badSdk.stderr).toContain(paths[1]);writeFileSync(join(temporary,paths[1]!),originals[1]!);
  const restored=check();expect(restored.status,restored.stderr).toBe(0);
 }finally{rmSync(temporary,{recursive:true,force:true});}
 for(const[index,path]of paths.entries())expect(readFileSync(join(ROOT,path))).toEqual(originals[index]);
 for(const app of['web','ios','admin']){const manifest=JSON.parse(readFileSync(join(ROOT,`apps/${app}/package.json`),'utf8'));expect(manifest.dependencies['@fancy/client']).toBe('workspace:*');expect(manifest.dependencies['@fancy/contracts']).toBe('workspace:*');}
},15000);
