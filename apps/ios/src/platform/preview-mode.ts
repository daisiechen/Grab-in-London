import { Platform } from 'react-native';
import type { CredentialStore, StoredRefresh } from '../features/auth/credential-store.ts';

/**
 * Preview mode runs the app on the in-memory fake API (src/preview) with no server, Keychain or
 * sandbox file. On by default for the web build (used for side-by-side checks against demo/) and
 * opt-in on device with EXPO_PUBLIC_FANCY_PREVIEW=1.
 */
export function isPreviewMode(): boolean {
  return process.env.EXPO_PUBLIC_FANCY_PREVIEW === '1' || Platform.OS === 'web';
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
