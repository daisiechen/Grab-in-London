import { createAppChallenge } from './pkce.ts';
import { base64UrlEncode } from '../../platform/base64url.ts';

const sha256 = async (data: Uint8Array) => globalThis.crypto.subtle.digest('SHA-256', data as unknown as BufferSource);

describe('app challenge (PKCE S256 style)', () => {
  it('derives challenge = base64url(SHA-256(verifier)) with contract-valid shapes', async () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, i) => i * 7);
    const pair = await createAppChallenge({ randomBytes: () => bytes, sha256 });
    expect(pair.verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    const expected = base64UrlEncode(new Uint8Array(await sha256(new TextEncoder().encode(pair.verifier))));
    expect(pair.challenge).toBe(expected);
  });

  it('matches the RFC 7636 appendix B example', async () => {
    const rfcBytes = Uint8Array.from([116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77, 105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121]);
    const pair = await createAppChallenge({ randomBytes: () => rfcBytes, sha256 });
    expect(pair.verifier).toBe('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(pair.challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('base64UrlEncode', () => {
  it.each([
    [[], ''],
    [[0xff], '_w'],
    [[0xfb, 0xff], '-_8'],
    [[0, 1, 2], 'AAEC'],
  ])('%j → %s', (input, out) => {
    expect(base64UrlEncode(Uint8Array.from(input))).toBe(out);
  });
});
