import * as SecureStore from 'expo-secure-store';
import { secureGuestCredentialStore } from './guest-store.ts';

// Native Keychain calls are substituted. These assertions do not exercise an iPhone Keychain.
jest.mock('expo-secure-store',()=>({WHEN_UNLOCKED_THIS_DEVICE_ONLY:17,getItemAsync:jest.fn(),setItemAsync:jest.fn(),deleteItemAsync:jest.fn()}));
const options={keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
beforeEach(()=>jest.clearAllMocks());
it('serialises only the fixed-expiry guest credential, never AI conversation fields',async()=>{
 const store=secureGuestCredentialStore();
 await store.write({token:'synthetic-guest-only',expiresAt:86400000,transcript:'DO_NOT_PERSIST',deviceToken:'DO_NOT_PERSIST'} as {token:string;expiresAt:number});
 expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fancy.assistant.guest.v1',JSON.stringify({token:'synthetic-guest-only',expiresAt:86400000}),options);
});
it('uses the same this-device-only accessibility and propagates locked reads while removing corrupt storage',async()=>{
 const store=secureGuestCredentialStore();jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({token:'synthetic-guest-only',expiresAt:86400000}));
 await expect(store.read()).resolves.toEqual({token:'synthetic-guest-only',expiresAt:86400000});expect(SecureStore.getItemAsync).toHaveBeenCalledWith('fancy.assistant.guest.v1',options);
 await store.clear();expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fancy.assistant.guest.v1',options);
 jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('Keychain locked'));await expect(store.read()).rejects.toThrow('Keychain locked');
 jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('{corrupt');await expect(store.read()).resolves.toBeNull();
 expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
});
it('does not bypass a failed corrupt-record deletion',async()=>{
 jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('{corrupt');
 jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('locked deletion'));
 await expect(secureGuestCredentialStore().read()).rejects.toThrow('locked deletion');
});
