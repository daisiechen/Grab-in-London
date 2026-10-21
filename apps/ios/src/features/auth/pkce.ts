import * as ExpoCrypto from 'expo-crypto';
import { base64UrlEncode } from '../../platform/base64url.ts';

export interface AppChallengePair {
  /** Sent only to exchangeHandoff (`appVerifier`, 43–128 unreserved chars). */
  verifier: string;
  /** Sent to startOAuth/verifyEmail (`appChallenge`): base64url(SHA-256(verifier)), PKCE S256 style. */
  challenge: string;
}

export interface PkceDeps {
  randomBytes: (n: number) => Uint8Array;
  sha256: (data: Uint8Array) => Promise<ArrayBuffer>;
}

const defaultDeps: PkceDeps = {
  randomBytes: (n) => ExpoCrypto.getRandomBytes(n),
  sha256: (data) => ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data as unknown as BufferSource),
};

/** Fresh pair per sign-in attempt; held in memory only and discarded after one exchange. */
export async function createAppChallenge(deps: PkceDeps = defaultDeps): Promise<AppChallengePair> {
  const verifier = base64UrlEncode(deps.randomBytes(32));
  const encoded = new Uint8Array(verifier.length);
  for (let i = 0; i < verifier.length; i++) encoded[i] = verifier.charCodeAt(i);
  const challenge = base64UrlEncode(new Uint8Array(await deps.sha256(encoded)));
  return { verifier, challenge };
}
