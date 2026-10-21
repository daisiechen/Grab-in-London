import { describe, expect, it } from 'vitest';
import { canonicalJson, requestHash } from './canonical.ts';

describe('canonical request hashing', () => {
  it('ignores key order and undefined fields', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe('{"a":{"d":[1,{"x":1,"y":2}]},"b":1}');
    expect(requestHash({ method: 'post', path: '/v1/x', body: { a: 1, b: 2 } })).toBe(requestHash({ method: 'POST', path: '/v1/x', body: { b: 2, a: 1 } }));
  });

  it('distinguishes path, version precondition and body', () => {
    const base = { method: 'POST', path: '/v1/meals/1/cancel', ifMatch: '"3"', body: { reason: 'host' } };
    const h = requestHash(base);
    expect(requestHash({ ...base, path: '/v1/meals/2/cancel' })).not.toBe(h);
    expect(requestHash({ ...base, ifMatch: '"4"' })).not.toBe(h);
    expect(requestHash({ ...base, body: { reason: 'other' } })).not.toBe(h);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
