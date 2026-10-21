import {memoryGuestCredentialStore} from './guest-store.ts';
import {createTestApp,signIn} from '../../test/render.tsx';
import {NOW} from '../../test/fixtures.ts';
import {flush} from '../../test/deferred.ts';
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
