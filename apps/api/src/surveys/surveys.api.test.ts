import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });
async function browser() { const b = new Browser(h); await b.signInWithEmail(`${randomUUID()}@example.invalid`); return b; }
const put = (b: Browser, body: unknown, v = '0') => b.request('PUT', '/v1/me/product-survey', { body, headers: { 'if-match': `"${v}"`, 'idempotency-key': randomUUID() } });
describe('independent product survey', () => {
  it('has a null unanswered default, accepts No and preserves immutable prior revisions', async () => {
    const b = await browser();
    expect(json(await b.request('GET', '/v1/me/product-survey')).data).toEqual({ version: '0', again: null, reasons: [], submittedAt: null });
    const a = await put(b, { again: false, reasons: [] });
    expect(a.statusCode, a.body).toBe(200);
    expect(json(a).data).toMatchObject({ version: '1', again: false });
    const next = await put(b, { again: null, reasons: ['conversation'] }, '1');
    expect(json(next).data).toMatchObject({ version: '2', again: null, reasons: ['conversation'] });
    const { rows } = await h.db.pool.query(`SELECT again, reasons FROM product_surveys ORDER BY version`);
    expect(rows).toEqual([{ again: false, reasons: [] }, { again: null, reasons: ['conversation'] }]);
  });
  it('rejects empty/duplicate reasons, meal attribution, stale versions and access to another person', async () => {
    const a = await browser(); const b = await browser();
    for (const body of [{ again: null, reasons: [] }, { again: true, reasons: ['cost', 'cost'] }, { again: true, reasons: [], mealId: randomUUID() }]) expect((await put(a, body)).statusCode).toBe(422);
    expect((await put(a, { again: true, reasons: [] })).statusCode).toBe(200);
    expect((await put(a, { again: false, reasons: [] })).statusCode).toBe(409);
    expect(json(await b.request('GET', '/v1/me/product-survey')).data.version).toBe('0');
  });
});
