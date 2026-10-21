import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, inject, it } from 'vitest';
import { Browser, createHarness, json, type Harness } from '../test/harness.ts';
import { londonTime } from '../meals/time.ts';
let h: Harness;
beforeAll(async () => { h = await createHarness(inject('pgServerUrl')); });
afterAll(async () => { await h.close(); });
async function actor() {
  const b = new Browser(h);
  const { body } = await b.signInWithEmail(`${randomUUID()}@example.invalid`);
  return { b, id: body.data.session.user.id as string };
}
async function unrelatedDeletion() {
  const other = await actor();
  // The deletion transaction's security effects, isolated from its reauth/provider protocol.
  await h.db.pool.query(`WITH removed AS (UPDATE users SET status='DELETED' WHERE id=$1 RETURNING id)
    UPDATE privacy_control SET epoch=epoch+1 WHERE id=1 AND EXISTS(SELECT 1 FROM removed)`, [other.id]);
}
it('replays the identical own survey after unrelated deletion without another business write', async () => {
  const a = await actor(), key = randomUUID();
  const options = { body: { again: true, reasons: ['conversation'] }, headers: { 'if-match': '"0"', 'idempotency-key': key } };
  const first = await a.b.request('PUT', '/v1/me/product-survey', options);
  expect(first.statusCode, first.body).toBe(200);
  await unrelatedDeletion();
  const replay = await a.b.request('PUT', '/v1/me/product-survey', options);
  expect(replay.statusCode, replay.body).toBe(200);
  expect(json(replay)).toEqual(json(first));
  expect(replay.headers['idempotent-replay']).toBe('true');
  expect((await h.db.pool.query('SELECT 1 FROM product_surveys WHERE user_id=$1', [a.id])).rowCount).toBe(1);
  await h.db.pool.query(`UPDATE idempotency SET response_json=jsonb_set(response_json,'{data,otherProfile}',$3::jsonb) WHERE actor_id=$1 AND key=$2`, [a.id, key, JSON.stringify({ id: randomUUID() })]);
  expect((await a.b.request('PUT', '/v1/me/product-survey', options)).statusCode).toBe(403);
  await h.db.pool.query("UPDATE users SET status='DELETED' WHERE id=$1", [a.id]);
  expect((await a.b.request('PUT', '/v1/me/product-survey', options)).statusCode).not.toBe(200);
});

it('replays only the applicant-owned application and rejects third-person or newly added fields', async () => {
  const host = await actor(), a = await actor();
  for (const user of [host, a]) {
    const updated = await user.b.request('PATCH', '/v1/me', { body: { displayName: 'Alex Test', bio: 'I enjoy shared meals and meeting new people.', languages: ['en'], lifeStatus: 'NEW_TO_LONDON', interests: ['FOOD'], ageConfirmedVersion: '2026-10-21', communityAcceptedVersion: '2026-10-21' }, headers: { 'if-match': '"1"', 'idempotency-key': randomUUID() } });
    expect(updated.statusCode, updated.body).toBe(200);
  }
  const venue = await host.b.request('POST', '/v1/venues/confirm', { body: { placeId: 'fixture_fancy_north' }, headers: { 'idempotency-key': randomUUID() } });
  const start = new Date(Math.floor((Date.now() + 5 * 86_400_000) / 60_000) * 60_000);
  const time = (d: Date) => { const t = londonTime(d); return { localDate: t.localDate, localTime: t.localTime, timeZone: t.timeZone, utcOffsetMinutes: t.utcOffsetMinutes }; };
  const meal = await host.b.request('POST', '/v1/meals', { body: {
    venueRef: json(venue).data.venueRef, title: 'Friendly lunch with new people', description: 'Join a relaxed meal to share stories and good food.',
    start: time(start), close: time(new Date(start.getTime() - 3_600_000)), minimum: 2, capacity: 3,
    budgetMinPence: 1000, budgetMaxPence: 3000, languages: ['en'], mood: 'EASY_CONVERSATION', cuisineCode: 'CHINESE', dietaryCodes: ['VEGAN'],
    bookingMode: 'EXTERNAL_PAY_AT_VENUE', attemptId: randomUUID(), bookingDeclarationConfirmed: true, reviewConfirmed: true, termsVersion: '2026-10-21',
  }, headers: { 'idempotency-key': randomUUID() } });
  expect(meal.statusCode, meal.body).toBe(201);
  const mealId = json(meal).data.id, key = randomUUID();
  const options = { body: { message: 'I would enjoy meeting everyone at this meal.' }, headers: { 'idempotency-key': key } };
  const first = await a.b.request('POST', `/v1/meals/${mealId}/applications`, options);
  expect(first.statusCode, first.body).toBe(201);
  await unrelatedDeletion();
  const replay = await a.b.request('POST', `/v1/meals/${mealId}/applications`, options);
  expect(replay.statusCode, replay.body).toBe(201);
  expect(json(replay)).toEqual(json(first));
  expect((await h.db.pool.query('SELECT 1 FROM applications WHERE user_id=$1 AND meal_id=$2', [a.id, mealId])).rowCount).toBe(1);
  const stored = (await h.db.pool.query('SELECT response_json FROM idempotency WHERE actor_id=$1 AND key=$2', [a.id, key])).rows[0].response_json;
  const thirdPerson = structuredClone(stored); thirdPerson.data.applicant.id = host.id;
  const unknownProfile = structuredClone(stored); unknownProfile.data.applicant.reviews = [{ author: { id: host.id } }];
  const unknownBackground = structuredClone(stored); unknownBackground.data.applicant.background.otherProfile = { id: host.id };
  const unknownMeta = structuredClone(stored); unknownMeta.meta.owner = host.id;
  for (const body of [thirdPerson, unknownProfile, unknownBackground, unknownMeta]) {
    await h.db.pool.query('UPDATE idempotency SET response_json=$3 WHERE actor_id=$1 AND key=$2', [a.id, key, JSON.stringify(body)]);
    expect((await a.b.request('POST', `/v1/meals/${mealId}/applications`, options)).statusCode).toBe(403);
  }
  await h.db.pool.query('UPDATE idempotency SET response_json=$3 WHERE actor_id=$1 AND key=$2', [a.id, key, JSON.stringify(stored)]);
  await h.db.pool.query('UPDATE applications SET user_id=$2 WHERE id=$1', [stored.data.id, host.id]);
  expect((await a.b.request('POST', `/v1/meals/${mealId}/applications`, options)).statusCode).toBe(403);
  await h.db.pool.query('UPDATE applications SET user_id=$2 WHERE id=$1', [stored.data.id, a.id]);
  await h.db.pool.query("UPDATE users SET status='DELETED' WHERE id=$1", [a.id]);
  expect((await a.b.request('POST', `/v1/meals/${mealId}/applications`, options)).statusCode).not.toBe(201);
});
