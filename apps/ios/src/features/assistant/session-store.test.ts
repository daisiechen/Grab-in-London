import * as SecureStore from 'expo-secure-store';
import {secureAIConversationStore,type AIConversationCredential} from './session-store.ts';
jest.mock('expo-secure-store',()=>({WHEN_UNLOCKED_THIS_DEVICE_ONLY:'WHEN_UNLOCKED_THIS_DEVICE_ONLY',getItemAsync:jest.fn(),setItemAsync:jest.fn(),deleteItemAsync:jest.fn()}));
const record:AIConversationCredential={sessionId:'9ac9d6e2-efbd-4b90-becd-f5599038a857',generation:1,deviceToken:'D'.repeat(43),revokeHandle:'R'.repeat(43),expiresAt:1800000,owner:{kind:'GUEST',credentialSha256:'a'.repeat(64)}};
beforeEach(()=>jest.clearAllMocks());
it('stores only bounded credential metadata with this-device-while-unlocked protection',async()=>{
 await secureAIConversationStore().write(record);expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fancy.assistant.session.v1',JSON.stringify(record),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
});
it('strictly rejects content fields and does not return a session id without its device proof',async()=>{
 for(const value of [{...record,text:'PRIVATE'}, {...record,deviceToken:undefined},{...record,owner:{kind:'GUEST'}},{...record,generation:'1'}]){
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(value));expect(await secureAIConversationStore().read()).toBeNull();
 }
 expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(4);
});
it('read or deletion failure remains an error, never a clean empty identity',async()=>{
 jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('locked'));await expect(secureAIConversationStore().read()).rejects.toThrow('locked');expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
 jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('{}');jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('locked'));await expect(secureAIConversationStore().read()).rejects.toThrow('locked');
});
