import { describe, expect, it } from 'vitest';
import { SUPPORT_EMAIL, supportMailto } from './support.ts';

describe('support exit (AC-001a)', () => {
  it('opens a plain mail editor to the published address with no receipt or token', () => {
    expect(SUPPORT_EMAIL).toBe('xcheniepaut26@gmail.com');
    const url = new URL(supportMailto());
    expect(url.protocol).toBe('mailto:');
    expect(url.pathname).toBe(SUPPORT_EMAIL);
    expect([...url.searchParams.keys()]).toEqual(['subject']);
    expect(supportMailto()).not.toMatch(/receipt|token|body=/i);
  });
});
