import { describe, expect, it } from 'vitest';
import { ApiError } from '@fancy/client';
import { Intent } from './webApi.ts';

const err = (status: number, code: string) => new ApiError({ status, code: code as never, message: code });

describe('Intent (one user intent = one Idempotency-Key)', () => {
  const noSleep = { sleep: async () => {} };

  it('reuses the key across transient retries of the same body', async () => {
    const intent = new Intent(noSleep);
    const keys: string[] = [];
    let n = 0;
    await intent.run({ a: 1 }, async (key) => {
      keys.push(key);
      if (++n < 3) throw err(503, 'PROVIDER_UNAVAILABLE');
      return 'ok';
    });
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
  });

  it('keeps the key when the user retries after a network failure with the same body', async () => {
    const intent = new Intent({ maxAttempts: 1 });
    const keys: string[] = [];
    await expect(intent.run({ a: 1 }, async (key) => { keys.push(key); throw err(0, 'NETWORK_ERROR'); })).rejects.toThrow();
    await intent.run({ a: 1 }, async (key) => { keys.push(key); return 1; });
    expect(keys[0]).toBe(keys[1]);
  });

  it('starts a new intent after a business rejection, a changed body, or success', async () => {
    const intent = new Intent({ maxAttempts: 1 });
    const keys: string[] = [];
    await expect(intent.run({ a: 1 }, async (key) => { keys.push(key); throw err(409, 'MEAL_FULL'); })).rejects.toThrow();
    await intent.run({ a: 1 }, async (key) => { keys.push(key); return 1; });
    await intent.run({ a: 1 }, async (key) => { keys.push(key); return 1; });
    await expect(intent.run({ a: 2 }, async (key) => { keys.push(key); throw err(0, 'NETWORK_ERROR'); })).rejects.toThrow();
    await intent.run({ a: 3 }, async (key) => { keys.push(key); return 1; });
    expect(new Set(keys).size).toBe(keys.length);
  });
});
