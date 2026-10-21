import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.ts';
const scope = { actor: 'user-a', resource: 'messages:c', filterHash: 'HISTORY', epoch: '3' };
describe('signed scoped pagination', () => {
  it('round-trips exact keys without offset or client-trusted data', () => {
    const cursor = encodeCursor('secret', scope, '9007199254740993', 1000);
    expect(decodeCursor('secret', scope, cursor, 1000)).toBe('9007199254740993');
  });
  it('rejects tampering, wrong actor/resource/filter/epoch, different key and expiry', () => {
    const cursor = encodeCursor('secret', scope, '42', 1000);
    for (const s of [{ ...scope, actor: 'user-b' }, { ...scope, resource: 'other' }, { ...scope, filterHash: 'LIVE' }, { ...scope, epoch: '4' }]) expect(() => decodeCursor('secret', s, cursor, 1000)).toThrow();
    expect(() => decodeCursor('wrong', scope, cursor, 1000)).toThrow();
    expect(() => decodeCursor('secret', scope, cursor + 'x', 1000)).toThrow();
    expect(() => decodeCursor('secret', scope, cursor, 86_401_000)).toThrow();
  });
});
