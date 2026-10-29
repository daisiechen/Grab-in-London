/**
 * Fake-vs-real parity probe (investigation tool, not part of CI): plays the same signed-in actor
 * scenario against the preview fake (src/preview/fake-api.ts) and the real API, then prints, step by
 * step, where status codes, error codes or the shape/values of the response differ.
 *   node apps/ios/e2e/parity.ts
 * Ids, timestamps and provider display data are masked; seed-dependent differences remain visible
 * and need a human read.
 */
import { randomUUID } from 'node:crypto';
import { ApiError, createApiClient, type ApiClient } from '@fancy/client';
import type { OperationId } from '@fancy/contracts';
import { startStack } from './stack.ts';
import { stackOptions } from './options.ts';
import { completeProfile, londonInput, publishMeal, signIn as realSignIn, type Actor } from './driver.ts';
import { createPreviewBackend, PREVIEW_IDS } from '../src/preview/fake-api.ts';
import { insertFinishedMeal, openDatabase } from './fixtures.ts';

type Result = { op: string; status: number; code?: string; body?: unknown };
type Call = (label: string, op: OperationId, request: unknown) => Promise<{ data?: unknown; page?: unknown; meta?: { version?: string } } | null>;

interface Side {
  name: 'fake' | 'real';
  actor: ApiClient;
  /** A meal hosted by someone else that the actor can apply to. */
  targetMealId: string;
  /** Host side: approve the actor's pending application. */
  approve(applicationId: string): Promise<void>;
  /** A meal that ended within the last 7 days with the actor and `pastMateId` (already present) at the table. */
  pastMealId: string;
  pastMateId: string;
  results: Result[];
}

/** Values compared literally; everything else is reduced to its JSON type (seed data differs by design). */
const SEMANTIC = new Set(['status', 'state', 'allowedActions', 'outcome', 'kind', 'canSend', 'dissolved', 'redacted', 'blocked', 'cancelReason', 'template', 'again', 'reasons', 'hasMore', 'round', 'value', 'arrangementLocked', 'stale', 'available', 'currency', 'bookingMode', 'declarationSource', 'client', 'profileComplete', 'missing', 'section', 'role', 'unreadCount', 'publicOutcome', 'avatarUrl']);
function mask(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) return SEMANTIC.has(key) ? value : value.length ? [mask(value[0])] : [];
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, mask(v, k)]));
  if (SEMANTIC.has(key)) return key === 'avatarUrl' ? (value === null ? null : '<url>') : value;
  return value === null ? null : `<${typeof value}>`;
}

function diff(a: unknown, b: unknown, path: string, out: string[]) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) out.push(`${path}: length fake=${a.length} real=${b.length}`);
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out);
    return;
  }
  out.push(`${path}: fake=${JSON.stringify(a)?.slice(0, 160)} real=${JSON.stringify(b)?.slice(0, 160)}`);
}

function caller(side: Side): Call {
  return async (label, op, request) => {
    // Stay under the API's per-actor write burst (10/s); the app never writes that fast.
    await sleep(side.name === 'real' ? 120 : 0);
    try {
      const loose = side.actor.call as (op: OperationId, request: unknown) => Promise<{ data?: unknown; page?: unknown; meta?: { version?: string } } | undefined>;
      const res = await loose(op, request);
      side.results.push({ op: label, status: 200, body: res ? { data: res.data, page: res.page, version: res.meta?.version } : null });
      return res ?? null;
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      side.results.push({ op: label, status: e.status, code: e.code, body: e.fieldErrors ? { fieldErrors: e.fieldErrors } : undefined });
      return null;
    }
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scenario(side: Side) {
  const call = caller(side);
  const d = <T>(r: { data?: unknown } | null) => r?.data as T;
  await call('getMe', 'getMe', {});
  const me = d<{ version: string }>(await call('getMe#2', 'getMe', {}));
  await call('updateMe stale', 'updateMe', { ifMatch: '999', idempotencyKey: randomUUID(), body: { displayName: 'Parity' } });
  await call('updateMe', 'updateMe', { ifMatch: me.version, idempotencyKey: randomUUID(), body: { displayName: 'Parity', interests: ['FOOD', 'BOOKS'] } });
  await call('discover limit=1', 'discoverMeals', { query: { limit: 1 } });
  await call('discover bad dates', 'discoverMeals', { query: { dates: '2026-13-01' } });
  await call('getMeal unknown', 'getMeal', { params: { mealId: randomUUID() } });
  const before = d<{ meal: { allowedActions: string[] } }>(await call('getMeal target', 'getMeal', { params: { mealId: side.targetMealId } }));
  void before;
  await call('apply short', 'applyMeal', { params: { mealId: side.targetMealId }, idempotencyKey: randomUUID(), body: { message: 'too short' } });
  const app = d<{ id: string; version: string }>(await call('apply', 'applyMeal', { params: { mealId: side.targetMealId }, idempotencyKey: randomUUID(), body: { message: 'I would really enjoy meeting everyone at this table.' } }));
  await call('apply again', 'applyMeal', { params: { mealId: side.targetMealId }, idempotencyKey: randomUUID(), body: { message: 'I would really enjoy meeting everyone at this table.' } });
  await call('getMeal pending', 'getMeal', { params: { mealId: side.targetMealId } });
  await call('listApplications own', 'listApplications', { params: { mealId: side.targetMealId } });
  await call('myMeals APPLICATIONS', 'myMeals', { query: { section: 'APPLICATIONS' } });
  await call('inbox pending', 'inbox', {});
  await call('withdraw stale', 'withdrawApplication', { params: { applicationId: app.id }, ifMatch: '999', idempotencyKey: randomUUID() });
  await call('withdraw', 'withdrawApplication', { params: { applicationId: app.id }, ifMatch: app.version, idempotencyKey: randomUUID() });
  await call('getMeal withdrawn', 'getMeal', { params: { mealId: side.targetMealId } });
  const app2 = d<{ id: string; version: string }>(await call('apply round 2', 'applyMeal', { params: { mealId: side.targetMealId }, idempotencyKey: randomUUID(), body: { message: 'Trying again, I would really enjoy this table.' } }));
  await side.approve(app2.id);
  const detail = d<{ conversationId: string | null; meal: { version: string } }>(await call('getMeal confirmed', 'getMeal', { params: { mealId: side.targetMealId } }));
  await call('myMeals UPCOMING', 'myMeals', { query: { section: 'UPCOMING' } });
  await call('inbox confirmed', 'inbox', {});
  const conv = detail?.conversationId;
  if (conv) {
    await call('readMessages HISTORY', 'readMessages', { params: { conversationId: conv }, query: { mode: 'HISTORY' } });
    await call('readMessages LIVE', 'readMessages', { params: { conversationId: conv }, query: { mode: 'LIVE', afterSeq: '0' } });
    const clientMessageId = randomUUID();
    const sent = d<{ seq: string }>(await call('sendMessage', 'sendMessage', { params: { conversationId: conv }, idempotencyKey: clientMessageId, body: { body: 'Hello everyone!', clientMessageId } }));
    await call('sendMessage replay', 'sendMessage', { params: { conversationId: conv }, idempotencyKey: clientMessageId, body: { body: 'Hello everyone!', clientMessageId } });
    await call('sendMessage blank', 'sendMessage', { params: { conversationId: conv }, idempotencyKey: randomUUID(), body: { body: '   ', clientMessageId: randomUUID() } });
    if (sent) await call('markConversationRead', 'markConversationRead', { params: { conversationId: conv }, body: { throughSeq: sent.seq } });
    await call('inbox after send', 'inbox', {});
  }
  await call('leaveMeal stale', 'leaveMeal', { params: { mealId: side.targetMealId }, ifMatch: '999', idempotencyKey: randomUUID() });
  const meal = d<{ meal: { version: string } }>(await call('getMeal before leave', 'getMeal', { params: { mealId: side.targetMealId } }));
  await call('leaveMeal', 'leaveMeal', { params: { mealId: side.targetMealId }, ifMatch: meal?.meal.version ?? '1', idempotencyKey: randomUUID() });
  await call('getMeal after leave', 'getMeal', { params: { mealId: side.targetMealId } });
  await call('myMeals UPCOMING after leave', 'myMeals', { query: { section: 'UPCOMING' } });
  await call('myMeals CANCELLED after leave', 'myMeals', { query: { section: 'CANCELLED' } });
  await call('myMeals PAST', 'myMeals', { query: { section: 'PAST' } });

  // Hosting.
  const venues = d<Array<{ placeId: string }>>(await call('searchVenues', 'searchVenues', { query: { north: 51.6, south: 51.4, east: 0, west: -0.3 } }));
  await call('searchVenues q', 'searchVenues', { query: { q: 'zzzz-no-match' } });
  const venue = d<{ venueRef: string }>(await call('confirmVenue', 'confirmVenue', { idempotencyKey: randomUUID(), body: { placeId: venues?.[0]?.placeId ?? 'none' } }));
  await call('confirmVenue unknown', 'confirmVenue', { idempotencyKey: randomUUID(), body: { placeId: 'no_such_place' } });
  const body = { venueRef: venue?.venueRef, title: 'Parity dinner', description: 'A relaxed dinner to compare the fake and the real API.', start: londonInput(8, 19), close: londonInput(8, 17), minimum: 2, capacity: 4, budgetMinPence: 1500, budgetMaxPence: 3000, languages: ['en'], mood: 'EASY_CONVERSATION', cuisineCode: null, bookingMode: 'EXTERNAL_PAY_AT_VENUE', attemptId: randomUUID(), bookingDeclarationConfirmed: true, reviewConfirmed: true, termsVersion: '2026-10-21' };
  await call('createMeal close after start', 'createMeal', { idempotencyKey: randomUUID(), body: { ...body, close: londonInput(8, 20), attemptId: randomUUID() } });
  await call('createMeal budget inverted', 'createMeal', { idempotencyKey: randomUUID(), body: { ...body, budgetMinPence: 4000, attemptId: randomUUID() } });
  await call('createMeal min>cap', 'createMeal', { idempotencyKey: randomUUID(), body: { ...body, minimum: 5, attemptId: randomUUID() } });
  const created = d<{ id: string; version: string }>(await call('createMeal', 'createMeal', { idempotencyKey: randomUUID(), body }));
  if (!created) throw new Error(`${side.name}: createMeal failed`);
  await call('getMeal hosted', 'getMeal', { params: { mealId: created.id } });
  await call('myMeals HOSTING', 'myMeals', { query: { section: 'HOSTING' } });
  await call('inbox hosting', 'inbox', {});
  await call('listApplications host', 'listApplications', { params: { mealId: created.id } });
  await call('editMeal stale', 'editMeal', { params: { mealId: created.id }, ifMatch: '999', idempotencyKey: randomUUID(), body: { title: 'Parity dinner edited' } });
  const edited = d<{ version: string }>(await call('editMeal', 'editMeal', { params: { mealId: created.id }, ifMatch: created.version, idempotencyKey: randomUUID(), body: { title: 'Parity dinner edited' } }));
  const booked = d<{ version: string }>(await call('declareBooking', 'declareBooking', { params: { mealId: created.id }, ifMatch: edited?.version ?? created.version, idempotencyKey: randomUUID(), body: { status: 'REPORTED_CONFIRMED', count: 4 } }));
  await call('cancelMeal stale', 'cancelMeal', { params: { mealId: created.id }, ifMatch: '999', idempotencyKey: randomUUID(), body: { reason: 'HOST_UNAVAILABLE' } });
  await call('cancelMeal', 'cancelMeal', { params: { mealId: created.id }, ifMatch: booked?.version ?? edited?.version ?? created.version, idempotencyKey: randomUUID(), body: { reason: 'HOST_UNAVAILABLE' } });
  await call('getMeal cancelled', 'getMeal', { params: { mealId: created.id } });
  await call('myMeals CANCELLED', 'myMeals', { query: { section: 'CANCELLED' } });
  await call('myMeals HOSTING after cancel', 'myMeals', { query: { section: 'HOSTING' } });

  // People & safety.
  const target = d<{ meal: { host: { id: string } } }>(await call('getMeal for host id', 'getMeal', { params: { mealId: side.targetMealId } }));
  const hostId = target.meal.host.id;
  await call('getPublicProfile', 'getPublicProfile', { params: { userId: hostId } });
  await call('getPublicProfile unknown', 'getPublicProfile', { params: { userId: randomUUID() } });
  const block = d<{ version: string }>(await call('getBlock', 'getBlock', { params: { subjectId: hostId } }));
  await call('getBlock self', 'getBlock', { params: { subjectId: d<{ id: string }>(await call('getMe#3', 'getMe', {})).id } });
  const blocked = d<{ version: string }>(await call('block', 'block', { params: { subjectId: hostId }, ifMatch: block?.version ?? '0', idempotencyKey: randomUUID() }));
  await call('listBlocks', 'listBlocks', {});
  await call('unblock stale', 'unblock', { params: { subjectId: hostId }, ifMatch: '999', idempotencyKey: randomUUID() });
  await call('unblock', 'unblock', { params: { subjectId: hostId }, ifMatch: blocked?.version ?? '0', idempotencyKey: randomUUID() });
  await call('listBlocks after', 'listBlocks', {});
  await call('getDirect', 'getDirect', { params: { subjectId: hostId } });
  const report = d<{ id: string }>(await call('createReport', 'createReport', { idempotencyKey: randomUUID(), body: { targetType: 'USER', targetId: hostId, reason: 'private_concern', details: 'Parity probe report.' } }));
  await call('createReport meal', 'createReport', { idempotencyKey: randomUUID(), body: { targetType: 'MEAL', targetId: side.targetMealId, reason: 'private_concern', details: 'Parity probe report.' } });
  if (report) await call('reportStatus', 'reportStatus', { params: { reportId: report.id } });
  await call('reportStatus unknown', 'reportStatus', { params: { reportId: randomUUID() } });
  const survey = d<{ version: string }>(await call('getSurvey', 'getSurvey', {}));
  await call('putSurvey empty', 'putSurvey', { ifMatch: survey?.version ?? '0', idempotencyKey: randomUUID(), body: { again: null, reasons: [] } });
  await call('putSurvey', 'putSurvey', { ifMatch: survey?.version ?? '0', idempotencyKey: randomUUID(), body: { again: true, reasons: [] } });
  await call('putSurvey stale', 'putSurvey', { ifMatch: survey?.version ?? '0', idempotencyKey: randomUUID(), body: { again: false, reasons: [] } });
  await call('getSurvey after', 'getSurvey', {});
  const notes = d<Array<{ id: string }>>(await call('listNotifications', 'listNotifications', { query: { limit: 30 } }));
  if (notes?.[0]) {
    const key = randomUUID();
    await call('markRead', 'markRead', { params: { notificationId: notes[0].id }, idempotencyKey: key });
    await call('markRead replay', 'markRead', { params: { notificationId: notes[0].id }, idempotencyKey: key });
  }
  await call('postMealState not ended', 'postMealState', { params: { mealId: side.targetMealId } });
  // After the meal (fake: the seeded past supper; real: a finished meal completed by the worker).
  await call('postMealState', 'postMealState', { params: { mealId: side.pastMealId } });
  await call('rateExperience before attendance', 'rateExperience', { params: { mealId: side.pastMealId }, ifMatch: '0', idempotencyKey: randomUUID(), body: { score: 4 } });
  const attended = d<{ version: string }>(await call('reportAttendance self', 'reportAttendance', { params: { mealId: side.pastMealId, subjectId: d<{ id: string }>(await call('getMe#4', 'getMe', {})).id }, ifMatch: '0', idempotencyKey: randomUUID(), body: { value: 'present' } }));
  void attended;
  await call('reportAttendance for mate (not host)', 'reportAttendance', { params: { mealId: side.pastMealId, subjectId: side.pastMateId }, ifMatch: '1', idempotencyKey: randomUUID(), body: { value: 'absent' } });
  await call('rateExperience', 'rateExperience', { params: { mealId: side.pastMealId }, ifMatch: '0', idempotencyKey: randomUUID(), body: { score: 4 } });
  await call('reviewPerson', 'reviewPerson', { params: { mealId: side.pastMealId, subjectId: side.pastMateId }, ifMatch: '0', idempotencyKey: randomUUID(), body: { body: 'Warm company and a lovely table.' } });
  const state = d<{ reconnect: Array<{ subjectId: string; version: string }> }>(await call('postMealState after feedback', 'postMealState', { params: { mealId: side.pastMealId } }));
  const row = state?.reconnect.find((r) => r.subjectId === side.pastMateId);
  await call('selectReconnect', 'selectReconnect', { params: { mealId: side.pastMealId, subjectId: side.pastMateId }, ifMatch: row?.version ?? '0', idempotencyKey: randomUUID(), body: { selected: true } });

  await call('getVenuePhoto', 'getVenuePhoto', { params: { venueRef: venue?.venueRef ?? randomUUID() }, query: {} });
  // Account deletion (fresh sign-in, so no re-authentication is needed).
  const receiptToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
  const meBefore = d<{ version: string }>(await call('getMe before deletion', 'getMe', {}));
  await call('requestDeletion', 'requestDeletion', { body: { confirm: true, receiptToken }, ifMatch: meBefore?.version ?? '1', idempotencyKey: randomUUID() });
  await call('getMe after deletion', 'getMe', {});
  await call('logout', 'logout', { body: { clientRequestId: randomUUID() } });
  await call('getMe after logout', 'getMe', {});
}

/** Sign-in / refresh / logout protocol as the app's SessionManager drives it (no actor needed). */
async function authScenario(name: 'fake' | 'real', base: string, doFetch: typeof fetch | undefined, email: string): Promise<Result[]> {
  const results: Result[] = [];
  const anon = createApiClient({ baseUrl: base, credentials: { kind: 'none' }, ...(doFetch ? { fetch: doFetch } : {}) });
  const rec = async <T>(label: string, run: () => Promise<T>): Promise<T | null> => {
    await sleep(name === 'real' ? 120 : 0);
    try { const r = await run() as { data?: unknown }; results.push({ op: label, status: 200, body: r ? { data: r.data } : null }); return r as T; }
    catch (e) { if (!(e instanceof ApiError)) throw e; results.push({ op: label, status: e.status, code: e.code }); return null; }
  };
  const verifier = 'v'.repeat(43);
  const appChallenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  await rec('startEmail bad email', () => anon.call('startEmail', { body: { clientRequestId: randomUUID(), email: 'not-an-email', client: 'IOS' } }));
  const start = await rec('startEmail', () => anon.call('startEmail', { body: { clientRequestId: randomUUID(), email, client: 'IOS' } }));
  if (!start) return results;
  await rec('startEmail resend too soon', () => anon.call('startEmail', { body: { clientRequestId: randomUUID(), email, client: 'IOS' } }));
  await rec('verifyEmail wrong code', () => anon.call('verifyEmail', { body: { clientRequestId: randomUUID(), challengeId: start.data.challengeId, code: '123456', appChallenge } }));
  await rec('verifyEmail unknown challenge', () => anon.call('verifyEmail', { body: { clientRequestId: randomUUID(), challengeId: randomUUID(), code: '000000', appChallenge } }));
  const verified = await rec('verifyEmail', () => anon.call('verifyEmail', { body: { clientRequestId: randomUUID(), challengeId: start.data.challengeId, code: '000000', appChallenge } }));
  await rec('verifyEmail reused', () => anon.call('verifyEmail', { body: { clientRequestId: randomUUID(), challengeId: start.data.challengeId, code: '000000', appChallenge } }));
  const code = verified && verified.data.outcome === 'AUTHENTICATED' ? verified.data.handoffCode ?? '' : '';
  await rec('exchangeHandoff wrong verifier', () => anon.call('exchangeHandoff', { body: { clientRequestId: randomUUID(), code, appVerifier: 'w'.repeat(43) } }));
  const creds = await rec('exchangeHandoff', () => anon.call('exchangeHandoff', { body: { clientRequestId: randomUUID(), code, appVerifier: verifier } }));
  await rec('exchangeHandoff reused', () => anon.call('exchangeHandoff', { body: { clientRequestId: randomUUID(), code, appVerifier: verifier } }));
  if (!creds || creds.data.client !== 'IOS') return results;
  const refreshed = await rec('refreshSession', () => anon.call('refreshSession', { body: { clientRequestId: randomUUID(), refreshToken: (creds.data as { refreshToken: string }).refreshToken } }));
  await rec('refreshSession old token', () => anon.call('refreshSession', { body: { clientRequestId: randomUUID(), refreshToken: (creds.data as { refreshToken: string }).refreshToken } }));
  const token = refreshed?.data.accessToken ?? '';
  const authed = createApiClient({ baseUrl: base, credentials: { kind: 'bearer', accessToken: () => token }, ...(doFetch ? { fetch: doFetch } : {}) });
  await rec('getSession', () => authed.call('getSession', {}));
  await rec('getMe new token', () => authed.call('getMe', {}));
  await rec('logout', () => authed.call('logout', { body: { clientRequestId: randomUUID() } }));
  await rec('getMe after logout', () => authed.call('getMe', {}));
  await rec('refreshSession after logout', () => anon.call('refreshSession', { body: { clientRequestId: randomUUID(), refreshToken: refreshed?.data.refreshToken ?? 'x'.repeat(43) } }));
  return results;
}

async function fakeSide(): Promise<Side> {
  const backend = createPreviewBackend({ latencyMs: 0, autoApproveAfterMs: 50 });
  const base = 'http://preview.local';
  const anon = createApiClient({ baseUrl: base, credentials: { kind: 'none' }, fetch: backend.fetch });
  const start = await anon.call('startEmail', { body: { clientRequestId: randomUUID(), email: 'alex@example.com', client: 'IOS' } });
  const verified = await anon.call('verifyEmail', { body: { clientRequestId: randomUUID(), challengeId: start.data.challengeId, code: '000000', appChallenge: 'c'.repeat(43) } });
  if (verified.data.outcome !== 'AUTHENTICATED') throw new Error('fake sign-in');
  const creds = await anon.call('exchangeHandoff', { body: { clientRequestId: randomUUID(), code: verified.data.handoffCode!, appVerifier: 'v'.repeat(43) } });
  const actor = createApiClient({ baseUrl: base, credentials: { kind: 'bearer', accessToken: () => creds.data.accessToken }, fetch: backend.fetch });
  const list = await actor.call('discoverMeals', { query: { limit: 50 } });
  const target = list.data.find((m) => m.allowedActions.includes('APPLY'));
  if (!target) throw new Error('fake: no meal open to apply');
  return { name: 'fake', actor, targetMealId: target.id, results: [], approve: async () => { await sleep(300); }, pastMealId: PREVIEW_IDS.meals.pastSupper, pastMateId: PREVIEW_IDS.users.maya };
}

async function realSide(apiUrl: string, databaseUrl: string): Promise<Side> {
  const run = randomUUID().slice(0, 8);
  const host: Actor = await realSignIn(apiUrl, `parity.host.${run}@example.invalid`, '000000');
  await completeProfile(host, 'Hana');
  const meal = await publishMeal(host, { placeId: 'fixture_fancy_north', title: 'Parity target table', days: 5 });
  const guest = await realSignIn(apiUrl, `parity.guest.${run}@example.invalid`, '000000');
  await completeProfile(guest, 'Alex');
  const actor: ApiClient = { call: (op, req) => guest.call(op, req) };
  // A meal that ended an hour ago, completed by the worker; the host already reported attending.
  const db = openDatabase(databaseUrl);
  const pastMealId = await insertFinishedMeal(db, { hostId: host.userId, guestId: guest.userId, venueRef: meal.venue.venueRef, title: 'Parity past supper', endedAgoMs: 3_600_000 }).finally(() => db.end());
  await host.call('reportAttendance', { params: { mealId: pastMealId, subjectId: host.userId }, ifMatch: '0', idempotencyKey: randomUUID(), body: { value: 'present' } });
  return {
    name: 'real', actor, targetMealId: meal.id, results: [], pastMealId, pastMateId: host.userId,
    approve: async (applicationId) => {
      const apps = await host.call('listApplications', { params: { mealId: meal.id } });
      const a = apps.data.find((x) => x.id === applicationId);
      await host.call('decideApplication', { params: { applicationId }, ifMatch: a!.version, idempotencyKey: randomUUID(), body: { decision: 'APPROVE' } });
    },
  };
}

const options = stackOptions();
const stack = await startStack({ ...options, database: `${options.database}_parity`, apiPort: options.apiPort + 1, serveWeb: false });
try {
  const fakeBackend = createPreviewBackend({ latencyMs: 0 });
  const authFake = await authScenario('fake', 'http://preview.local', fakeBackend.fetch, 'alex@example.com');
  const authReal = await authScenario('real', stack.apiUrl, undefined, `parity.auth.${randomUUID().slice(0, 8)}@example.invalid`);
  for (let i = 0; i < Math.max(authFake.length, authReal.length); i++) {
    const f = authFake[i], r = authReal[i];
    if (!f || !r || f.op !== r.op) { console.warn(`auth #${i} step mismatch fake=${f?.op} real=${r?.op}`); continue; }
    const out: string[] = [];
    if (f.status !== r.status || f.code !== r.code) out.push(`status fake=${f.status} ${f.code ?? ''} real=${r.status} ${r.code ?? ''}`);
    else diff(mask(f.body), mask(r.body), 'body', out);
    if (out.length) console.warn(`\n## auth: ${f.op}\n  ${out.join('\n  ')}`);
  }
  const fake = await fakeSide();
  const real = await realSide(stack.apiUrl, stack.databaseUrl);
  await scenario(fake);
  await scenario(real);
  const n = Math.max(fake.results.length, real.results.length);
  for (let i = 0; i < n; i++) {
    const f = fake.results[i], r = real.results[i];
    if (!f || !r || f.op !== r.op) { console.warn(`#${i} step mismatch fake=${f?.op} real=${r?.op}`); continue; }
    const out: string[] = [];
    if (f.status !== r.status || f.code !== r.code) out.push(`status fake=${f.status} ${f.code ?? ''} real=${r.status} ${r.code ?? ''}`);
    else diff(mask(f.body), mask(r.body), 'body', out);
    if (out.length) console.warn(`\n## ${f.op}\n  ${out.slice(0, 40).join('\n  ')}`);
  }
} finally {
  await stack.stop();
}
