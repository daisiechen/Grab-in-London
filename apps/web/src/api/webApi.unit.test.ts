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

describe('web transport account lifetime',()=>{
  it('rejects late private success and never lets an old 401 clear a newer session',async()=>{
    const {createWebApi}=await import('./webApi.ts');
    const {createFetchStub,deferred,ok,fail}=await import('../test/fetchStub.ts');
    const {me}=await import('../test/fixtures.ts');
    const pending=deferred<import('../test/fetchStub.ts').StubResponse>();
    const oldUnauthorized=deferred<import('../test/fetchStub.ts').StubResponse>();
    let calls=0,clears=0;
    const stub=createFetchStub({getMe:()=>++calls===1?pending.promise:oldUnauthorized.promise});
    const api=createWebApi({fetch:stub.fetch,baseUrl:'http://web.test'});api.onUnauthorized(()=>clears++);
    api.setCsrfToken('first');
    const a=api.client.call('getMe',{});const b=api.client.call('getMe',{});
    const checkedA=expect(a).rejects.toMatchObject({code:'STATE_CONFLICT'});const checkedB=expect(b).rejects.toMatchObject({code:'STATE_CONFLICT'});
    api.setCsrfToken(null);api.setCsrfToken('second');
    pending.resolve(ok(me()));oldUnauthorized.resolve(fail(401,'AUTH_REQUIRED'));
    await checkedA;await checkedB;expect(clears).toBe(0);
  });
});
