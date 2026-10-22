import {memoryAIConversationStore} from './session-store.ts';
import {memoryGuestCredentialStore} from './guest-store.ts';
import {createTestApp,signIn} from '../../test/render.tsx';
import {NOW,USER_ID,REFRESH_1} from '../../test/fixtures.ts';
import {flush} from '../../test/deferred.ts';
import {HANDOFF,credentials,sessionInfo} from '../../test/fixtures.ts';
import {ok} from '../../test/mock-fetch.ts';
it('allows login retry after a temporary Keychain read failure and sends the recovered guest for revocation',async()=>{
 const store=memoryGuestCredentialStore();await store.write({token:'synthetic-login-guest',expiresAt:NOW+86400000});
 const read=jest.fn().mockRejectedValueOnce(new Error('locked')).mockImplementation(()=>store.read());
 const app=createTestApp({guestStore:{...store,read}});
 app.mock.on('POST','/v1/auth/handoff',ok(credentials()));app.mock.on('GET','/v1/auth/session',ok(sessionInfo()));
 await expect(app.services.session.completeHandoff(HANDOFF,'V'.repeat(43))).rejects.toThrow('locked');
 expect(app.mock.calls).toHaveLength(0);
 await app.services.session.completeHandoff(HANDOFF,'V'.repeat(43));await flush();
 expect(app.mock.callsTo('POST','/v1/auth/handoff')[0]?.headers.authorization).toBe('Bearer synthetic-login-guest');
 expect(await store.read()).toBeNull();
});
it('retries the complete reinstall wipe after a temporary deletion failure before marking installation ready',async()=>{
 const store=memoryGuestCredentialStore();await store.write({token:'synthetic-old-install',expiresAt:NOW+86400000});
 let present=false;const clear=jest.fn().mockRejectedValueOnce(new Error('locked')).mockImplementation(()=>store.clear());
 const app=createTestApp({guestStore:{...store,clear},installMarker:{isPresent:async()=>present,set:async()=>{present=true;}}});
 await app.services.session.restore();expect(present).toBe(false);
 await app.services.assistant.restoreIdentity();expect(present).toBe(true);expect(await store.read()).toBeNull();
});
it('clears previous-install credentials before setting the shared sandbox marker',async()=>{
 const guestStore=memoryGuestCredentialStore();await guestStore.write({token:'synthetic-old-install',expiresAt:NOW+86400000});
 const set=jest.fn(async()=>{expect(await guestStore.read()).toBeNull();});
 const app=createTestApp({guestStore,installMarker:{isPresent:async()=>false,set}});
 await app.services.session.restore();await app.services.assistant.restoreIdentity();
 expect(set).toHaveBeenCalledTimes(1);expect(app.services.assistant.credential).toBeNull();expect(await guestStore.read()).toBeNull();
});
it('does not read past a failed reinstall wipe or establish a valid marker',async()=>{
 const read=jest.fn(async()=>({token:'synthetic-old-install',expiresAt:NOW+86400000}));const set=jest.fn();
 const app=createTestApp({guestStore:{read,write:jest.fn(),clear:async()=>{throw new Error('locked');}},installMarker:{isPresent:async()=>false,set}});
 await app.services.session.restore();await expect(app.services.assistant.restoreIdentity()).rejects.toThrow('locked');
 expect(set).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();expect(app.mock.calls).toEqual([]);
});
it('restores persisted guest for native login revocation but never attaches it to session reads',async()=>{
 const guestStore=memoryGuestCredentialStore();await guestStore.write({token:'synthetic-login-guest',expiresAt:NOW+86400000});const app=createTestApp({guestStore});
 await signIn(app);await flush();
 const login=app.mock.calls.find(c=>c.path==='/v1/auth/handoff');expect(login?.headers.authorization).toBe('Bearer synthetic-login-guest');
 const session=app.mock.calls.find(c=>c.path==='/v1/auth/session');expect(session?.headers.authorization).not.toContain('synthetic-login-guest');
 expect(await guestStore.read()).toBeNull();expect(app.services.assistant.credential).toBeNull();
});

it('first same-owner auth restore adopts AI credential metadata without issuing an AI request',async()=>{

 const ai=memoryAIConversationStore();await ai.write({sessionId:'9ac9d6e2-efbd-4b90-becd-f5599038a857',generation:1,deviceToken:'D'.repeat(43),revokeHandle:'R'.repeat(43),expiresAt:NOW+1800000,owner:{kind:'USER',userId:USER_ID}});
 const app=createTestApp({aiConversationStore:ai,installMarker:{isPresent:async()=>true,set:jest.fn()}});await app.store.writeRefresh({refreshToken:REFRESH_1,refreshExpiresAt:new Date(NOW+86400000).toISOString()});
 app.mock.on('POST','/v1/auth/refresh',ok(credentials()));app.mock.on('GET','/v1/auth/session',ok(sessionInfo()));await app.services.session.restore();app.services.assistant.open();await flush();
 expect(app.services.assistant.getSnapshot()).toMatchObject({restorable:true,turns:[],preferences:{areas:[]}});expect(await ai.read()).not.toBeNull();expect(app.mock.calls.some(c=>c.path.startsWith('/v1/ai/'))).toBe(false);
});
it('missing installation marker clears auth, guest and AI before setting the new marker',async()=>{
 const ai=memoryAIConversationStore(),guests=memoryGuestCredentialStore();
 await ai.write({sessionId:'synthetic-old-install',generation:1,deviceToken:'synthetic-device',revokeHandle:'synthetic-revoke',expiresAt:NOW+1800000,owner:{kind:'GUEST',credentialSha256:'a'.repeat(64)}});await guests.write({token:'synthetic-old-guest',expiresAt:NOW+86400000});
 const marker=jest.fn(async()=>{expect(await ai.read()).toBeNull();expect(await guests.read()).toBeNull();});const app=createTestApp({aiConversationStore:ai,guestStore:guests,installMarker:{isPresent:async()=>false,set:marker}});await app.services.session.restore();expect(marker).toHaveBeenCalledTimes(1);expect(app.mock.calls).toHaveLength(0);
});
it('AI wipe failure never marks a reinstall ready or reaches any auth/AI API',async()=>{
 const ai=memoryAIConversationStore();const clear=jest.fn().mockRejectedValueOnce(new Error('locked')).mockImplementation(()=>ai.clear());let present=false;const set=jest.fn(async()=>{present=true;});
 const app=createTestApp({aiConversationStore:{...ai,clear},installMarker:{isPresent:async()=>present,set}});await app.services.session.restore();expect(set).not.toHaveBeenCalled();expect(app.services.session.getState().status).toBe('unavailable');expect(app.mock.calls).toHaveLength(0);await app.services.assistant.restoreIdentity();expect(set).toHaveBeenCalledTimes(1);expect(clear).toHaveBeenCalledTimes(2);
});
it('explicit login clears an existing AI token and guest, while initial refresh does not masquerade as login',async()=>{
 const ai=memoryAIConversationStore(),guests=memoryGuestCredentialStore();await guests.write({token:'synthetic-login-current-guest',expiresAt:NOW+86400000});
 await ai.write({sessionId:'synthetic-login-ai',generation:1,deviceToken:'synthetic-device',revokeHandle:'synthetic-revoke',expiresAt:NOW+1800000,owner:{kind:'GUEST',credentialSha256:'a'.repeat(64)}});
 const app=createTestApp({aiConversationStore:ai,guestStore:guests});await signIn(app);await flush();expect(await ai.read()).toBeNull();expect(await guests.read()).toBeNull();expect(app.mock.callsTo('POST','/v1/auth/handoff')[0]?.headers.authorization).toBe('Bearer synthetic-login-current-guest');
});
