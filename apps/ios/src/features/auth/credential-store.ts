import * as SecureStore from 'expo-secure-store';

/**
 * Refresh token persistence. Only the rotating refresh token is stored (Keychain, this device only,
 * unavailable while locked); the 15-minute access token never leaves memory.
 */
export interface CredentialStore {
  readRefresh(): Promise<StoredRefresh | null>;
  writeRefresh(value: StoredRefresh): Promise<void>;
  clear(): Promise<void>;
}

export interface StoredRefresh {
  refreshToken: string;
  refreshExpiresAt: string;
}

const KEY = 'fancy.session.refresh.v1';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export function secureCredentialStore(): CredentialStore {
  return {
    async readRefresh() {
      const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Partial<StoredRefresh>;
        if (typeof parsed.refreshToken === 'string' && typeof parsed.refreshExpiresAt === 'string') {
          return { refreshToken: parsed.refreshToken, refreshExpiresAt: parsed.refreshExpiresAt };
        }
      } catch {
        // Corrupt entry: treat as signed out and remove below.
      }
      await SecureStore.deleteItemAsync(KEY, OPTIONS);
      return null;
    },
    async writeRefresh(value) {
      await SecureStore.setItemAsync(KEY, JSON.stringify(value), OPTIONS);
    },
    async clear() {
      await SecureStore.deleteItemAsync(KEY, OPTIONS);
    },
  };
}

/**
 * iOS Keychain items survive app deletion. An install marker kept in app-sandbox storage (wiped on
 * uninstall) lets the first launch of a reinstall discard the old Keychain refresh token.
 */
export interface InstallMarker {
  isPresent(): Promise<boolean>;
  set(): Promise<void>;
}
