import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });

describe('venue confirmation with real transaction and idempotency', () => {
  it('confirms only server-resolved IDs, dedupes durable references, and persists no provider display content', async () => {
    const b = new Browser(h);
    await b.signInWithEmail(`venue-${randomUUID()}@example.invalid`);
    const key = randomUUID();
    const body = { placeId: 'fixture_fancy_north' };
    const first = await b.request('POST', '/v1/venues/confirm', { body, headers: { 'idempotency-key': key } });
    expect(first.statusCode).toBe(200);
    expect(json(first).data).toMatchObject({ placeId: body.placeId, available: true, name: null, address: null, location: null, displayExpiresAt: null });
    const replay = await b.request('POST', '/v1/venues/confirm', { body, headers: { 'idempotency-key': key } });
    expect(replay.statusCode).toBe(200);
    expect(replay.headers['idempotent-replay']).toBe('true');
    expect(json(replay).data.venueRef).toBe(json(first).data.venueRef);
    const second = await b.request('POST', '/v1/venues/confirm', { body, headers: { 'idempotency-key': randomUUID() } });
    expect(json(second).data.venueRef).toBe(json(first).data.venueRef);
    const persisted = await h.db.pool.query(`SELECT * FROM venues WHERE place_id = $1`, [body.placeId]);
    expect(persisted.rows).toHaveLength(1);
    expect(JSON.stringify(persisted.rows)).not.toContain('Kitchen');
    const intents = await h.db.pool.query(`SELECT response_json FROM idempotency WHERE operation = 'confirmVenue'`);
    expect(JSON.stringify(intents.rows)).not.toContain('Kitchen');
  });
  it('rejects unknown or malicious IDs and client display overrides without inserting a venue', async () => {
    const b = new Browser(h);
    await b.signInWithEmail(`venue-${randomUUID()}@example.invalid`);
    for (const [body, status] of [
      [{ placeId: 'unknown_restaurant' }, 404], [{ placeId: '../path' }, 422],
      [{ placeId: 'fixture_fancy_south', name: 'Forged' }, 422],
    ] as const) {
      const response = await b.request('POST', '/v1/venues/confirm', { body, headers: { 'idempotency-key': randomUUID() } });
      expect(response.statusCode).toBe(status);
    }
    const rows = await h.db.pool.query(`SELECT place_id FROM venues WHERE place_id IN ('unknown_restaurant', 'fixture_fancy_south')`);
    expect(rows.rowCount).toBe(0);
  });
  it('prevents an inactive actor from confirming a venue despite an existing browser cookie', async () => {
    const b = new Browser(h);
    const signed = await b.signInWithEmail(`venue-${randomUUID()}@example.invalid`);
    const userId = signed.body.data.session.user.id;
    await h.db.pool.query(`UPDATE users SET status = 'DELETED' WHERE id = $1`, [userId]);
    const response = await b.request('POST', '/v1/venues/confirm', { body: { placeId: 'fixture_fancy_south' }, headers: { 'idempotency-key': randomUUID() } });
    expect(response.statusCode).toBe(401);
  });
});
