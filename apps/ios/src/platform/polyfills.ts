import * as ExpoCrypto from 'expo-crypto';

/**
 * Hermes has no WebCrypto `crypto.randomUUID`, but @fancy/client's `newIntentKey()` (one
 * Idempotency-Key per user intent) calls it. Install expo-crypto's native CSPRNG UUID before
 * any API call; never replace an existing implementation.
 */
type CryptoHost = { crypto?: { randomUUID?: () => string } };

export function ensureRandomUUID(host: CryptoHost = globalThis as unknown as CryptoHost): void {
  const existing = host.crypto;
  if (typeof existing?.randomUUID === 'function') return;
  const randomUUID = (): string => ExpoCrypto.randomUUID();
  if (existing) {
    Object.defineProperty(existing, 'randomUUID', { value: randomUUID, configurable: true, writable: true });
  } else {
    host.crypto = { randomUUID };
  }
}
