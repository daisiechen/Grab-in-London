import { Platform } from 'react-native';
import type { CredentialStore, StoredRefresh } from '../features/auth/credential-store.ts';

/**
 * Preview mode runs the app on the in-memory fake API (src/preview) with no server, Keychain or
 * sandbox file. On by default for the web build (used for side-by-side checks against demo/) and
 * opt-in on device with EXPO_PUBLIC_FANCY_PREVIEW=1. EXPO_PUBLIC_FANCY_PREVIEW=0 turns it off on
 * web too, so the browser build talks to the real API (end-to-end runs, see apps/ios/e2e).
 */
export function isPreviewMode(flag: string | undefined = process.env.EXPO_PUBLIC_FANCY_PREVIEW, os: string = Platform.OS): boolean {
  if (flag === '1') return true;
  if (flag === '0') return false;
  return os === 'web';
}

/**
 * The web build has no Keychain (expo-secure-store) or sandbox install marker, so it always keeps
 * credentials in memory, also when it talks to the real API.
 */
export function usesMemoryStores(preview: boolean = isPreviewMode(), os: string = Platform.OS): boolean {
  return preview || os === 'web';
}

/** Preview stand-in for the Keychain: the session lives only as long as the process. */
export function memoryCredentialStore(): CredentialStore {
  let value: StoredRefresh | null = null;
  return {
    async readRefresh() { return value; },
    async writeRefresh(next) { value = next; },
    async clear() { value = null; },
  };
}

/** Generic in-memory stand-in for the other Keychain-backed stores (deletion receipt, AI session/guest). */
export function memoryStore<T>(): { read(): Promise<T | null>; write(value: T): Promise<void>; clear(): Promise<void> } {
  let value: T | null = null;
  return {
    async read() { return value; },
    async write(next) { value = next; },
    async clear() { value = null; },
  };
}
