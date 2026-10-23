import * as SecureStore from 'expo-secure-store';
import {secureDeletionReceiptStore,type DeletionReceipt} from './deletion-receipt-store.ts';
import {deferred} from '../../test/deferred.ts';
jest.mock('expo-secure-store',()=>({WHEN_UNLOCKED_THIS_DEVICE_ONLY:17,getItemAsync:jest.fn(),setItemAsync:jest.fn(),deleteItemAsync:jest.fn()}));
const options={keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
const record:DeletionReceipt={ownerId:'6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11',key:'3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',receiptToken:'s'.repeat(43)};
it('uses device-only locked Keychain, survives store reconstruction, never persists personal content',async()=>{
 const store=secureDeletionReceiptStore();await store.write(record);
 expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fancy.deletion.receipt.v1',JSON.stringify(record),options);
 jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(record));await expect(secureDeletionReceiptStore().read()).resolves.toEqual(record);
 await expect(store.write({...record,privateText:'not allowed'} as DeletionReceipt)).rejects.toThrow('Invalid removal reference metadata');
});
it('malformed receipt fails closed; locked/corrupt-clear failures propagate without returning any record',async()=>{
 const store=secureDeletionReceiptStore();jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('{}');await expect(store.read()).rejects.toThrow('Saved removal reference is unavailable');expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('fancy.deletion.receipt.v1',options);
 jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('locked'));await expect(store.read()).rejects.toThrow('locked');
 jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('{bad');jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('locked'));await expect(store.read()).rejects.toThrow('locked');
});
it('serializes asynchronous writes and forget does not remove a newer intent',async()=>{
 const pending=deferred<void>();jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(()=>pending.promise);
 const store=secureDeletionReceiptStore();const first=store.write(record);const next={...record,receiptToken:'t'.repeat(43)};const second=store.write(next);
 await Promise.resolve();expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);pending.resolve();await first;await second;expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2);
 jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(next));await store.clear(record.receiptToken);expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
 jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(next));await store.clear(next.receiptToken);expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
});
