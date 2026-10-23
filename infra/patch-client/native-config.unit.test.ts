import {createRequire} from 'node:module';
import {describe,it,expect} from 'vitest';
const require=createRequire(import.meta.url);
const configure=require('./native-config.cjs') as (config:Record<string,unknown>,env:NodeJS.ProcessEnv)=>Record<string,unknown>;
describe('isolated native build identity',()=>{
 const original={name:'Fancy',ios:{bundleIdentifier:'uk.fancyabite.original'},scheme:'fancy'};
 it('preserves the sealed default configuration',()=>{expect(configure(original,{})).toBe(original);});
 it('cannot build patch against another API',()=>{expect(()=>configure(original,{FANCY_APP_VARIANT:'patch-p11'})).toThrow('PATCH_NATIVE_API_REQUIRED');});
 it('associates only an explicitly configured HTTPS synthetic host',()=>{
  const result=configure(original,{FANCY_APP_VARIANT:'patch-p11',EXPO_PUBLIC_API_BASE_URL:'http://127.0.0.1:64176',EXPO_PUBLIC_MEAL_ORIGIN:'https://p11-share.example.invalid'});
  expect(result.ios).toEqual({bundleIdentifier:'uk.fancyabite.patch.p11',associatedDomains:['applinks:p11-share.example.invalid']});
  expect(original.ios).toEqual({bundleIdentifier:'uk.fancyabite.original'});
 });
 it.each(['http://unsafe.invalid','https://unsafe.invalid/path','https://unsafe.invalid?token=x','https://unsafe.invalid:444'])('rejects unsafe associated domain input %s',origin=>{
  expect(()=>configure(original,{FANCY_APP_VARIANT:'patch-p11',EXPO_PUBLIC_API_BASE_URL:'http://127.0.0.1:64176',EXPO_PUBLIC_MEAL_ORIGIN:origin})).toThrow();
 });
 it('uses a distinct bundle and callback without modifying the original',()=>{const result=configure(original,{FANCY_APP_VARIANT:'patch-p11',EXPO_PUBLIC_API_BASE_URL:'http://127.0.0.1:64176'});expect(result.ios).toEqual({bundleIdentifier:'uk.fancyabite.patch.p11'});expect(result.scheme).toBe('fancyp11');expect(original.scheme).toBe('fancy');});
});
