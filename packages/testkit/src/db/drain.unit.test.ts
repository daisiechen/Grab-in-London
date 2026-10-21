import pg from 'pg';
import { expect, it, vi } from 'vitest';
import { trackPoolDrain } from './drain.ts';

it('waits for actual client end before permitting forced database teardown', async () => {
  const pool = new pg.Pool();
  const close = trackPoolDrain(pool);
  const client = new pg.Client();
  pool.emit('connect', client);
  let signal!: () => void;
  const endCalled = new Promise<void>((resolve) => { signal = resolve; });
  vi.spyOn(pool, 'end').mockImplementation(async () => { signal(); });
  let finished = false;
  const stopping = close().then(() => { finished = true; });
  await endCalled;
  await Promise.resolve();
  expect(finished).toBe(false);
  client.emit('end');
  await stopping;
  expect(finished).toBe(true);
});
