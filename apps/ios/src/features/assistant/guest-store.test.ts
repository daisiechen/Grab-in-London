import {memoryGuestCredentialStore} from './guest-store.ts';
import {createTestApp,signIn} from '../../test/render.tsx';
import {NOW} from '../../test/fixtures.ts';
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
