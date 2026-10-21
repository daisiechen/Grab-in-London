import {describe,expect,it,vi} from 'vitest';
import {loadConfig} from '@fancy/config';
import {mailProviderFor} from '../main.ts';
import {ResendMailProvider} from './resend-provider.ts';
import {UnavailableMailProvider} from './delivery.ts';
// Constructed synthetic fixture sentinel, not a real provider credential.
const sentinel=['re','SYNTHETIC','SELECTION','FIXTURE'].join('_');
const base={ENVIRONMENT:'test',DATABASE_URL:'postgres://fixture@127.0.0.1:5432/fancy_test',AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',AI_PROVIDER:'disabled',WEB_ORIGIN:'https://fancy.example',SESSION_SECRET:['test','session','secret','0123456789abcdef0123456789abcdef'].join('-')};
describe('worker mail provider configuration selection',()=>{
 it('selects Resend only with explicit provider mode plus a complete configuration',()=>{
  const network=vi.spyOn(globalThis,'fetch');try{
   const config=loadConfig({...base,MAIL_ADAPTER:'provider',RESEND_API_KEY:sentinel,RESEND_FROM:'Fancy <noreply@example.invalid>'});
   expect(mailProviderFor(config)).toBeInstanceOf(ResendMailProvider);expect(mailProviderFor(config).kind).toBe('real');expect(network).not.toHaveBeenCalled();
  }finally{network.mockRestore();}
 });
 it('stays unavailable when provider credentials are absent',async()=>{
  const network=vi.spyOn(globalThis,'fetch');try{const config=loadConfig({...base,MAIL_ADAPTER:'provider'}),provider=mailProviderFor(config);expect(provider).toBeInstanceOf(UnavailableMailProvider);expect(provider.kind).toBe('unavailable');expect(await provider.lookup('synthetic-outbox')).toEqual({status:'UNKNOWN'});expect(network).not.toHaveBeenCalled();}finally{network.mockRestore();}
 });
 it('does not enable real sending merely because credentials exist in outbox-test mode',()=>{
  const network=vi.spyOn(globalThis,'fetch');try{const config=loadConfig({...base,MAIL_ADAPTER:'outbox_test',RESEND_API_KEY:sentinel,RESEND_FROM:'Fancy <noreply@example.invalid>'});expect(mailProviderFor(config)).toBeInstanceOf(UnavailableMailProvider);expect(network).not.toHaveBeenCalled();}finally{network.mockRestore();}
 });
});
