import {createPool} from '@fancy/db';
import {createHash,createHmac} from 'node:crypto';
import * as receipts from '../../../api/src/mail/receipts.ts';
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

it('runtime selection supplies the durable admission hook and never fetches a refused claim',async()=>{
 const pool=createPool(base.DATABASE_URL,{application:'synthetic-provider-selection'}),admit=vi.spyOn(receipts,'admitResendDispatch').mockResolvedValue(false),network=vi.spyOn(globalThis,'fetch');
 try{const config=loadConfig({...base,MAIL_ADAPTER:'provider',RESEND_API_KEY:sentinel,RESEND_FROM:'Fancy <noreply@example.invalid>'});const provider=mailProviderFor(config,pool);expect(await provider.send({idempotencyKey:'d52bfb88-a732-4c73-b9c3-cf28028ac17e',claimToken:'82442355-32c3-4580-8749-7af0a3c74b84',email:'synthetic@example.invalid',template:'meal_cancelled',refs:{}})).toEqual({status:'UNKNOWN'});expect(admit).toHaveBeenCalledWith(pool,expect.objectContaining({outboxId:'d52bfb88-a732-4c73-b9c3-cf28028ac17e',claimToken:'82442355-32c3-4580-8749-7af0a3c74b84'}));expect(network).not.toHaveBeenCalled();}finally{admit.mockRestore();network.mockRestore();await pool.end();}
});

it('persists a secret-keyed request fingerprint rather than a guessable recipient payload hash',async()=>{
 const pool=createPool(base.DATABASE_URL,{application:'synthetic-marker-hmac'}),admit=vi.spyOn(receipts,'admitResendDispatch').mockResolvedValue(false);
 const input={idempotencyKey:'d52bfb88-a732-4c73-b9c3-cf28028ac17e',claimToken:'82442355-32c3-4580-8749-7af0a3c74b84',email:'synthetic@example.invalid',template:'meal_cancelled',refs:{}};
 let wire='';const network=vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{wire=String(init?.body);return new Response(JSON.stringify({id:'24ba6727-6b45-491c-bd7b-9fe77d01b9bc'}),{status:200});});
 try{
  const config=loadConfig({...base,MAIL_ADAPTER:'provider',RESEND_API_KEY:sentinel,RESEND_FROM:'Fancy <noreply@example.invalid>'});
  await new ResendMailProvider({...config.resend!,webOrigin:config.webOrigin}).send(input);network.mockClear();
  await mailProviderFor(config,pool).send(input);
  const plain=createHash('sha256').update(wire).digest('hex'),persisted=admit.mock.calls[0]?.[1].payloadSha256;
  expect(persisted).not.toBe(plain);expect(persisted).toBe(createHmac('sha256',config.sessionSecret).update(plain).digest('hex'));expect(network).not.toHaveBeenCalled();
 }finally{admit.mockRestore();network.mockRestore();await pool.end();}
});
