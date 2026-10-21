import type pg from 'pg';

/** pg-pool can resolve end() before its clients' socket end callbacks finish. */
export function trackPoolDrain(pool: pg.Pool): () => Promise<void> {
  const closing = new Set<Promise<void>>();
  pool.on('connect', (client) => {
    const ended = new Promise<void>((resolve) => client.once('end', resolve));
    closing.add(ended);
    void ended.then(() => closing.delete(ended));
  });
  return async () => {
    await pool.end();
    await Promise.all(closing);
  };
}
