import * as SecureStore from 'expo-secure-store';
export interface GuestCredential {token:string;expiresAt:number}
export interface GuestCredentialStore {read():Promise<GuestCredential|null>;write(value:GuestCredential):Promise<void>;clear():Promise<void>}
const KEY='fancy.assistant.guest.v1';
const OPTIONS:SecureStore.SecureStoreOptions={keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
export function secureGuestCredentialStore():GuestCredentialStore{return {
 async read(){const raw=await SecureStore.getItemAsync(KEY,OPTIONS);if(!raw)return null;const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||!('token'in value)||typeof value.token!=='string'||!value.token||!('expiresAt'in value)||typeof value.expiresAt!=='number'||!Number.isFinite(value.expiresAt))throw new Error('Invalid guest credential');return {token:value.token,expiresAt:value.expiresAt};},
 async write(value){await SecureStore.setItemAsync(KEY,JSON.stringify({token:value.token,expiresAt:value.expiresAt}),OPTIONS);},
 async clear(){await SecureStore.deleteItemAsync(KEY,OPTIONS);},
};}
export function memoryGuestCredentialStore():GuestCredentialStore{let value:GuestCredential|null=null;return {read:async()=>value?{...value}:null,write:async next=>{value={...next};},clear:async()=>{value=null;}};}
