import { ApiError, createApiClient, type ApiClient } from '@fancy/client';
import { ErrorBody, Meta, PageInfo, T, operationsById, type OperationDef } from '@fancy/contracts';
import { ajv } from '../../../../packages/contracts/src/test-ajv.ts';
import { SessionManager, sessionClient } from '../features/auth/session.ts';
import { startEmailChallenge, verifyEmailCode } from '../features/auth/otp.ts';
import type { CredentialStore, StoredRefresh } from '../features/auth/credential-store.ts';
import { createPreviewBackend, previewImageKey, PREVIEW_IDS, PREVIEW_NOW, type PreviewOptions } from './fake-api.ts';

const BASE = 'http://preview.local';
const { meals: M, users: U } = PREVIEW_IDS;
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
function memoryStore(): CredentialStore {
  let value: StoredRefresh | null = null;
  return { readRefresh: async () => value, writeRefresh: async (next) => { value = next; }, clear: async () => { value = null; } };
}
const challenge = async () => ({ challenge: 'c'.repeat(43), verifier: 'v'.repeat(43) });

// Every response is validated against the contract's success envelope or ErrorBody, like the server's serializer.
const routes = Object.values(operationsById).map((def: OperationDef) => ({ def, regex: new RegExp(`^/v1${def.path.replace(/\{[A-Za-z]+\}/g, '[^/]+')}$`) }));
const validators = new Map<string, ReturnType<typeof ajv.compile>>();
function validatorFor(def: OperationDef) {
  let v = validators.get(def.operationId);
  if (!v) {
    const data = def.success.data!;
    v = ajv.compile(def.success.list ? T.Object({ data: T.Array(data), page: PageInfo, meta: Meta }, { additionalProperties: false }) : T.Object({ data, meta: Meta }, { additionalProperties: false }));
    validators.set(def.operationId, v);
  }
  return v;
}
const errorValidator = ajv.compile(ErrorBody);

function setup(opts: PreviewOptions = {}) {
  const clock = { t: PREVIEW_NOW };
  const backend = createPreviewBackend({ now: () => clock.t, latencyMs: 0, ...opts });
  const problems: string[] = [];
  const checkedFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const res = await backend.fetch(input, init);
    const url = new URL(String(input));
    const route = routes.find((r) => r.def.method === (init?.method ?? 'GET') && r.regex.test(url.pathname));
    if (res.status !== 204) {
      const body = await res.clone().json();
      const ok = route && res.status === route.def.success.status;
      const validator = ok ? (route.def.success.data ? validatorFor(route.def) : null) : errorValidator;
      if (validator && !validator(body)) problems.push(`${init?.method} ${url.pathname} ${res.status}: ${JSON.stringify(validator.errors)}`);
    }
    return res;
  }) as typeof fetch;
  let token: string | null = null;
  const raw = createApiClient({ baseUrl: BASE, credentials: { kind: 'bearer', accessToken: () => token }, fetch: checkedFetch });
  const transport = createApiClient({ baseUrl: BASE, credentials: { kind: 'bearer', accessToken: () => session.accessToken() }, fetch: checkedFetch });
  const session: SessionManager = new SessionManager({
    api: transport,
    withToken: (t) => createApiClient({ baseUrl: BASE, credentials: { kind: 'bearer', accessToken: () => t }, fetch: checkedFetch }),
    store: memoryStore(),
    installMarker: null,
    newId,
    onClear: [],
  });
  const api: ApiClient = sessionClient(transport, session);
  return { backend, clock, problems, raw, transport, session, api, setToken: (t: string | null) => (token = t) };
}

/** Normal app sign-in: email OTP through the iOS session manager. */
async function signIn(ctx: ReturnType<typeof setup>) {
  const deps = { api: ctx.transport, session: ctx.session, createChallenge: challenge, newId };
  const started = await startEmailChallenge(deps.api, 'alex@example.com', newId);
  if (!started.ok) throw new Error(started.message);
  const result = await verifyEmailCode(deps, started.challenge, '000000', ctx.backend.now()); // the app passes services.now()
  if (result.kind !== 'signedIn') throw new Error(`sign-in failed: ${JSON.stringify(result)}`);
  return result;
}

const expectApiError = async (promise: Promise<unknown>, status: number, code: string) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect({ status: (error as ApiError).status, code: (error as ApiError).code }).toEqual({ status, code });
  return error as ApiError;
};

afterEach(() => {
  n = 0;
});

describe('preview fake API', () => {
  it('signs in with email OTP through the real session manager, refreshes and logs out', async () => {
    const ctx = setup();
    const result = await signIn(ctx);
    expect(result.session.user).toMatchObject({ id: U.alex, displayName: 'Alex', email: 'alex@example.com', avatarRef: 'avatar:leo', profileGate: { profileComplete: true, missing: [] } });
    expect(ctx.session.getState().status).toBe('signedIn');
    expect(ctx.session.accessToken()).toMatch(/^pv_access_/);

    const me = await ctx.api.call('getMe', {});
    expect(me.meta.version).toBe(me.data.version);
    const before = ctx.session.accessToken();
    await ctx.session.refresh();
    expect(ctx.session.accessToken()).not.toBe(before);
    expect((await ctx.api.call('getSession', {})).data.amr).toEqual(['otp']);

    const token = ctx.session.accessToken()!;
    expect(await ctx.session.logout()).toEqual({ serverRevoked: true });
    ctx.setToken(token);
    await expectApiError(ctx.raw.call('getMe', {}), 401, 'AUTH_REQUIRED');
    expect(ctx.problems).toEqual([]);
  });

  it('rejects used and unknown OTP challenges and offers no provider sign-in by default', async () => {
    const ctx = setup();
    const start = await ctx.raw.call('startEmail', { body: { clientRequestId: newId(), email: 'someone@example.com', client: 'IOS' } });
    await ctx.raw.call('verifyEmail', { body: { clientRequestId: newId(), challengeId: start.data.challengeId, code: '123456' } });
    await expectApiError(ctx.raw.call('verifyEmail', { body: { clientRequestId: newId(), challengeId: start.data.challengeId, code: '000000' } }), 409, 'STATE_CONFLICT');
    await expectApiError(ctx.raw.call('verifyEmail', { body: { clientRequestId: newId(), challengeId: newId(), code: '000000' } }), 404, 'NOT_FOUND');
    await expectApiError(ctx.raw.call('verifyEmail', { body: { clientRequestId: newId(), challengeId: start.data.challengeId, code: '12ab56' } }), 422, 'VALIDATION_FAILED');
    await expectApiError(ctx.raw.call('startOAuth', { body: { clientRequestId: newId(), provider: 'GOOGLE', client: 'IOS' } }), 503, 'PROVIDER_UNAVAILABLE');
    expect(ctx.problems).toEqual([]);
  });

  it('discovers the demo meals with r07 budget and host-reported booking, and applies filters', async () => {
    const ctx = setup();
    const guest = await ctx.raw.call('discoverMeals', { query: {} });
    expect(guest.data.map((m) => m.title)).toEqual(['Ramen & new faces', 'An easy Friday supper', 'Lunch with someone new', 'A Saturday table in Soho', 'Small plates, big stories']);
    expect(guest.page).toEqual({ hasMore: false, nextCursor: null });
    const supper = guest.data.find((m) => m.id === M.supper)!;
    expect(supper).toMatchObject({
      title: 'An easy Friday supper', venue: { name: 'The Little Table', available: true, areaCode: 'soho' }, areaCode: 'soho',
      startsAt: { localDate: '2026-10-23', localTime: '19:00', utcOffsetMinutes: 60, instant: '2026-10-23T18:00:00.000Z' },
      closesAt: { localTime: '18:00' }, capacity: 4, confirmedCount: 3, minimum: 3, budgetMinPence: 2500, budgetMaxPence: 3500, currency: 'GBP',
      languages: ['en'], mood: 'EASY_CONVERSATION', cuisineCode: 'EUROPEAN', dietaryCodes: ['VEGETARIAN_OPTIONS'], bookingMode: 'EXTERNAL_PAY_AT_VENUE',
      declarationSource: 'host_reported', bookingDeclaration: null, status: 'OPEN', allowedActions: [],
    });
    expect(supper.host).toMatchObject({ id: U.maya, displayName: 'Maya', languages: ['en', 'hi'], interests: ['FOOD', 'DESIGN', 'BOOKS'], background: { work: 'Product designer' } });
    expect(previewImageKey(supper.host.avatarUrl)).toBe('maya');
    expect(JSON.stringify(guest.data)).not.toMatch(/deposit|payment|refund/i);
    expect(guest.data.find((m) => m.id === M.ramen)!.bookingDeclaration).toMatchObject({ status: 'REPORTED_CONFIRMED', declaredCount: 5, stale: false });

    await signIn(ctx);
    const signedIn = await ctx.api.call('discoverMeals', { query: { areaCodes: 'soho' } });
    expect(signedIn.data.map((m) => m.id)).toEqual([M.supper, M.sohoSaturday]);
    expect(signedIn.data[0]!.allowedActions).toEqual(['APPLY']);
    expect((await ctx.api.call('discoverMeals', { query: { timeOfDay: 'lunch' } })).data.map((m) => m.id)).toEqual([M.duo]);
    expect((await ctx.api.call('discoverMeals', { query: { keyword: 'cosy bowl & ramen'.slice(0, 9) } })).data.map((m) => m.id)).toEqual([M.ramen]);
    expect((await ctx.api.call('discoverMeals', { query: { tableSizes: '2', limit: 1 } })).data).toHaveLength(1);
    const paged = await ctx.api.call('discoverMeals', { query: { limit: 2 } });
    expect(paged.page.hasMore).toBe(true);
    expect((await ctx.api.call('discoverMeals', { query: { limit: 2, cursor: paged.page.nextCursor! } })).data[0]!.id).toBe(M.duo);
    expect((await ctx.api.call('getPublicProfile', { params: { userId: U.maya }, query: {} })).data.reviews[0]).toMatchObject({ author: { displayName: 'Emma' }, mealId: M.pastSupper });
    expect(ctx.problems).toEqual([]);
  });

  it('applies to a meal, then the seeded host approves and the group chat opens', async () => {
    const ctx = setup({ autoApproveAfterMs: 8_000 });
    await signIn(ctx);
    const applied = await ctx.api.call('applyMeal', { params: { mealId: M.supper }, body: { message: 'I’m new to London and would love to meet people over a relaxed meal.' }, idempotencyKey: newId() });
    expect(applied.data).toMatchObject({ state: 'PENDING', round: 1, applicant: { displayName: 'Alex' } });
    let detail = await ctx.api.call('getMeal', { params: { mealId: M.supper } });
    expect(detail.data.meal.allowedActions).toEqual(['WITHDRAW']);
    expect(detail.data.conversationId).toBeNull();
    const inbox = await ctx.api.call('inbox', { query: {} });
    expect(inbox.data[0]).toMatchObject({ application: { state: 'PENDING' }, applicationMeal: { title: 'An easy Friday supper', hostDisplayName: 'Maya' } });

    ctx.clock.t += 10_000;
    detail = await ctx.api.call('getMeal', { params: { mealId: M.supper } });
    expect(detail.data.myApplication?.state).toBe('CONFIRMED');
    expect(detail.data.meal).toMatchObject({ confirmedCount: 4, allowedActions: ['OPEN_GROUP', 'LEAVE'] });
    const messages = await ctx.api.call('readMessages', { params: { conversationId: detail.data.conversationId! }, query: { mode: 'HISTORY' } });
    expect(messages.data.map((m) => `${m.sender.displayName}: ${m.body}`)).toEqual(['Emma: Hi Alex, see you there! 😊', 'Maya: Welcome to “An easy Friday supper”, Alex! Shall we meet outside five minutes before?']);
    expect((await ctx.api.call('listNotifications', { query: {} })).data[0]).toMatchObject({ template: 'application_approved', mealId: M.supper });
    // Group rows carry the host as their avatar.
    expect((await ctx.api.call('inbox', { query: {} })).data.find((i) => i.conversation?.id === detail.data.conversationId)?.conversation?.avatar).toMatchObject({ displayName: 'Maya' });
    expect((await ctx.api.call('myMeals', { query: { section: 'UPCOMING' } })).data.map((i) => [i.meal.id, i.role])).toEqual([[M.supper, 'GUEST']]);
    // Full table: nobody else can apply.
    expect((await ctx.api.call('getMeal', { params: { mealId: M.supper } })).data.meal.confirmedCount).toBe(4);

    const left = await ctx.api.call('leaveMeal', { params: { mealId: M.supper }, ifMatch: detail.data.meal.version, idempotencyKey: newId() });
    expect(left.data).toMatchObject({ application: { state: 'CANCELLED' }, meal: { confirmedCount: 3 } });
    expect(ctx.problems).toEqual([]);
  });

  it('lets Alex host: publish, review Emma’s request, approve, then the arrangement locks', async () => {
    const ctx = setup();
    await signIn(ctx);
    const candidates = await ctx.api.call('searchVenues', { query: { q: 'little' } });
    expect(candidates.data.map((v) => v.name)).toEqual(['The Little Table']);
    const venue = await ctx.api.call('confirmVenue', { body: { placeId: candidates.data[0]!.placeId }, idempotencyKey: newId() });
    const time = (localDate: string, localTime: string) => ({ localDate, localTime, timeZone: 'Europe/London' as const });
    const created = await ctx.api.call('createMeal', {
      body: {
        venueRef: venue.data.venueRef, title: 'Supper for new Londoners', description: 'Sharing plates and easy conversation with new faces.',
        start: time('2026-10-30', '19:00'), close: time('2026-10-30', '18:00'), minimum: 2, capacity: 4, budgetMinPence: 2500, budgetMaxPence: 3500,
        languages: ['en'], mood: 'EASY_CONVERSATION', cuisineCode: 'EUROPEAN', dietaryCodes: ['VEGAN', 'VEGETARIAN_OPTIONS'], bookingMode: 'EXTERNAL_PAY_AT_VENUE',
        attemptId: newId(), bookingDeclarationConfirmed: true, reviewConfirmed: true, termsVersion: '2026-10-21',
      },
      idempotencyKey: newId(),
    });
    expect(created.data).toMatchObject({ confirmedCount: 1, startsAt: { utcOffsetMinutes: 0, instant: '2026-10-30T19:00:00.000Z' }, dietaryCodes: ['VEGETARIAN_OPTIONS', 'VEGAN'], areaCode: 'soho', bookingDeclaration: { status: 'REPORTED_CONFIRMED', declaredCount: 4, stale: false } });
    expect(created.data.allowedActions).toEqual(['OPEN_GROUP', 'CANCEL', 'DECLARE_BOOKING', 'REVIEW_APPLICATIONS', 'EDIT']);
    // The host's own group appears in Inbox straight away (host is its first member, like apps/api).
    expect((await ctx.api.call('inbox', { query: {} })).data.map((i) => i.conversation?.title)).toContain('Supper for new Londoners');

    const requests = await ctx.api.call('listApplications', { params: { mealId: created.data.id }, query: {} });
    expect(requests.data).toHaveLength(1);
    const emma = requests.data[0]!;
    expect(emma).toMatchObject({ state: 'PENDING', applicant: { displayName: 'Emma' } });
    expect(emma.message).toContain('I’d love to join');

    await expectApiError(ctx.api.call('decideApplication', { params: { applicationId: emma.id }, body: { decision: 'APPROVE' }, ifMatch: '7', idempotencyKey: newId() }), 409, 'VERSION_CONFLICT');
    const decided = await ctx.api.call('decideApplication', { params: { applicationId: emma.id }, body: { decision: 'APPROVE' }, ifMatch: emma.version, idempotencyKey: newId() });
    expect(decided.data.application.state).toBe('CONFIRMED');
    const meal = (await ctx.api.call('getMeal', { params: { mealId: created.data.id } })).data.meal;
    expect(meal).toMatchObject({ confirmedCount: 2, arrangementLocked: true, version: decided.data.mealVersion, bookingDeclaration: { stale: true } });
    expect(meal.allowedActions).not.toContain('EDIT');
    await expectApiError(ctx.api.call('editMeal', { params: { mealId: meal.id }, body: { title: 'A new title here' }, ifMatch: meal.version, idempotencyKey: newId() }), 409, 'ARRANGEMENT_LOCKED');
    const declared = await ctx.api.call('declareBooking', { params: { mealId: meal.id }, body: { status: 'REPORTED_CONFIRMED', count: 2 }, ifMatch: meal.version, idempotencyKey: newId() });
    expect(declared.data.bookingDeclaration).toMatchObject({ revision: '2', declaredCount: 2, stale: false });
    expect((await ctx.api.call('myMeals', { query: { section: 'HOSTING' } })).data.map((i) => i.role)).toEqual(['HOST']);
    const cancelled = await ctx.api.call('cancelMeal', { params: { mealId: meal.id }, body: { reason: 'host' }, ifMatch: declared.data.version, idempotencyKey: newId() });
    expect(cancelled.data).toMatchObject({ status: 'CANCELLED', cancelReason: 'host' });
    expect(ctx.problems).toEqual([]);
  });

  it('reads, sends and acknowledges group messages; leaving makes the chat read-only', async () => {
    const ctx = setup();
    await signIn(ctx);
    const inbox = await ctx.api.call('inbox', { query: {} });
    expect(inbox.data).toHaveLength(1);
    const item = inbox.data[0]!;
    expect(item).toMatchObject({ conversation: { kind: 'GROUP', title: 'A little supper club', mealId: M.pastSupper, canSend: true }, unreadCount: 2, lastMessage: { preview: 'Sounds lovely! This is my first meal here. 😊' } });
    const conversationId = item.conversation!.id;

    const history = await ctx.api.call('readMessages', { params: { conversationId }, query: { mode: 'HISTORY', limit: 1 } });
    expect(history.data.map((m) => m.body)).toEqual(['Sounds lovely! This is my first meal here. 😊']);
    expect(history.page.hasMore).toBe(true);
    const older = await ctx.api.call('readMessages', { params: { conversationId }, query: { mode: 'HISTORY', cursor: history.page.nextCursor! } });
    expect(older.data[0]).toMatchObject({ sender: { displayName: 'Maya' } });

    const clientMessageId = newId();
    const sent = await ctx.api.call('sendMessage', { params: { conversationId }, body: { body: '  Thanks both — lovely evening!  ', clientMessageId } });
    expect(sent.data).toMatchObject({ body: 'Thanks both — lovely evening!', sender: { id: U.alex }, redacted: false });
    expect((await ctx.api.call('sendMessage', { params: { conversationId }, body: { body: 'Thanks both — lovely evening!', clientMessageId } })).data.id).toBe(sent.data.id);
    await expectApiError(ctx.api.call('sendMessage', { params: { conversationId }, body: { body: 'Different text', clientMessageId } }), 409, 'IDEMPOTENCY_CONFLICT');
    const live = await ctx.api.call('readMessages', { params: { conversationId }, query: { mode: 'LIVE', afterSeq: older.data[0]!.seq } });
    expect(live.data.map((m) => m.body)).toEqual(['Sounds lovely! This is my first meal here. 😊', 'Thanks both — lovely evening!']);
    expect(live.page.scannedThroughSeq).toBe(sent.data.seq);

    await ctx.api.call('markConversationRead', { params: { conversationId }, body: { throughSeq: sent.data.seq } });
    expect((await ctx.api.call('inbox', { query: {} })).data[0]!.unreadCount).toBe(0);
    await expectApiError(ctx.api.call('markConversationRead', { params: { conversationId }, body: { throughSeq: '999' } }), 422, 'VALIDATION_FAILED');

    const left = await ctx.api.call('leaveGroup', { params: { conversationId }, body: { confirm: true }, ifMatch: item.conversation!.version, idempotencyKey: newId() });
    expect(left.data).toMatchObject({ canSend: false, dissolved: false });
    await expectApiError(ctx.api.call('sendMessage', { params: { conversationId }, body: { body: 'Hello?', clientMessageId: newId() } }), 403, 'FORBIDDEN');
    expect((await ctx.api.call('readMessages', { params: { conversationId }, query: { mode: 'HISTORY' } })).data).toHaveLength(3);
    await expectApiError(ctx.api.call('dissolveGroup', { params: { conversationId }, body: { confirm: true }, ifMatch: left.data.version, idempotencyKey: newId() }), 403, 'FORBIDDEN');
    expect(ctx.problems).toEqual([]);
  });

  it('runs the post-meal flow for the past supper: attendance, rating, reference, reconnect, survey', async () => {
    const ctx = setup();
    await signIn(ctx);
    const past = await ctx.api.call('myMeals', { query: { section: 'PAST' } });
    expect(past.data.map((i) => [i.meal.title, i.role, i.meal.status])).toEqual([['A little supper club', 'GUEST', 'COMPLETED']]);
    expect(past.data[0]!.meal.allowedActions).toEqual(['OPEN_GROUP', 'POST_MEAL']);

    const state = await ctx.api.call('postMealState', { params: { mealId: M.pastSupper } });
    expect(state.data).toMatchObject({ windowOpen: true, windowOpensAt: '2026-10-15T20:00:00.000Z', windowClosesAt: '2026-10-22T20:00:00.000Z', experience: null, reviews: [] });
    expect(state.data.eligibleMembers.map((p) => p.displayName).sort()).toEqual(['Alex', 'Emma', 'Maya']);
    expect(state.data.attendance.find((a) => a.subjectId === U.alex)).toMatchObject({ value: 'unknown', version: '0' });
    expect(state.data.attendance.find((a) => a.subjectId === U.maya)).toMatchObject({ value: 'present', source: 'HOST' });

    await expectApiError(ctx.api.call('rateExperience', { params: { mealId: M.pastSupper }, body: { score: 5 }, ifMatch: '0', idempotencyKey: newId() }), 403, 'FORBIDDEN');
    await expectApiError(ctx.api.call('reportAttendance', { params: { mealId: M.pastSupper, subjectId: U.emma }, body: { value: 'absent' }, ifMatch: '1', idempotencyKey: newId() }), 403, 'FORBIDDEN');
    const attendance = await ctx.api.call('reportAttendance', { params: { mealId: M.pastSupper, subjectId: U.alex }, body: { value: 'present' }, ifMatch: '0', idempotencyKey: newId() });
    expect(attendance.data).toMatchObject({ value: 'present', source: 'SELF', selfValue: 'present', version: '1' });
    expect((await ctx.api.call('rateExperience', { params: { mealId: M.pastSupper }, body: { score: 5 }, ifMatch: '0', idempotencyKey: newId() })).data.version).toBe('1');
    const review = await ctx.api.call('reviewPerson', { params: { mealId: M.pastSupper, subjectId: U.maya }, body: { body: 'Maya was a generous, thoughtful host.' }, ifMatch: '0', idempotencyKey: newId() });
    expect(review.data).toMatchObject({ visibility: 'PENDING', publishAt: '2026-10-22T20:00:00.000Z', version: '1' });

    const maya = await ctx.api.call('selectReconnect', { params: { mealId: M.pastSupper, subjectId: U.maya }, body: { selected: true }, ifMatch: '0', idempotencyKey: newId() });
    expect(maya.data).toMatchObject({ selected: true, connection: 'OPEN' });
    const emma = await ctx.api.call('selectReconnect', { params: { mealId: M.pastSupper, subjectId: U.emma }, body: { selected: true }, ifMatch: '0', idempotencyKey: newId() });
    expect(emma.data).toMatchObject({ selected: true, connection: 'WAITING' });
    const direct = await ctx.api.call('getDirect', { params: { subjectId: U.maya } });
    expect(direct.data).toMatchObject({ kind: 'DIRECT', title: 'Maya', canSend: true });
    const opener = await ctx.api.call('readMessages', { params: { conversationId: direct.data.id }, query: { mode: 'HISTORY' } });
    expect(opener.data.map((m) => m.body)).toEqual(['Lovely meeting you! Shall we find another table soon?']);
    await expectApiError(ctx.api.call('getDirect', { params: { subjectId: U.emma } }), 404, 'NOT_FOUND');

    const blockState = await ctx.api.call('getBlock', { params: { subjectId: U.maya } });
    const blocked = await ctx.api.call('block', { params: { subjectId: U.maya }, ifMatch: blockState.data.version, idempotencyKey: newId() });
    expect(blocked.data).toEqual({ subjectId: U.maya, blocked: true, version: '1' });
    expect((await ctx.api.call('getDirect', { params: { subjectId: U.maya } })).data).toMatchObject({ canSend: false, avatar: { displayName: 'Maya' } });
    expect((await ctx.api.call('listBlocks', { query: {} })).data.map((b) => [b.profile.id, b.version])).toEqual([[U.maya, '1']]);
    await ctx.api.call('unblock', { params: { subjectId: U.maya }, ifMatch: '1', idempotencyKey: newId() });
    expect((await ctx.api.call('listBlocks', { query: {} })).data).toEqual([]);

    const survey = await ctx.api.call('getSurvey', {});
    expect(survey.data).toEqual({ version: '0', again: null, reasons: [], submittedAt: null });
    expect((await ctx.api.call('putSurvey', { body: { again: true, reasons: ['company', 'venue'] }, ifMatch: '0', idempotencyKey: newId() })).data).toMatchObject({ version: '1', again: true });
    await expectApiError(ctx.api.call('putSurvey', { body: { again: null, reasons: [] }, ifMatch: '1', idempotencyKey: newId() }), 422, 'VALIDATION_FAILED');

    ctx.clock.t = Date.parse('2026-10-22T20:00:00.000Z');
    expect((await ctx.api.call('postMealState', { params: { mealId: M.pastSupper } })).data.windowOpen).toBe(false);
    expect(ctx.problems).toEqual([]);
  });

  it('answers invalid input, auth, preconditions and unknown routes in the contract error envelope', async () => {
    const ctx = setup();
    const unknown = await ctx.backend.fetch(`${BASE}/v1/nope`, { method: 'GET' });
    expect(unknown.status).toBe(404);
    expect(errorValidator(await unknown.json())).toBe(true);
    await expectApiError(ctx.raw.call('myMeals', { query: { section: 'UPCOMING' } }), 401, 'AUTH_REQUIRED');

    await signIn(ctx);
    const short = await expectApiError(ctx.api.call('applyMeal', { params: { mealId: M.supper }, body: { message: 'Too short' }, idempotencyKey: newId() }), 422, 'VALIDATION_FAILED');
    expect(Object.keys(short.fieldErrors ?? {})).toEqual(['body.message']);
    await expectApiError(ctx.api.call('getMeal', { params: { mealId: 'not-a-uuid' } }), 422, 'VALIDATION_FAILED');
    await expectApiError(ctx.api.call('getMeal', { params: { mealId: newId() } }), 404, 'NOT_FOUND');
    const conflict = await expectApiError(ctx.api.call('updateMe', { body: { displayName: 'Alexandra' }, ifMatch: '1', idempotencyKey: newId() }), 409, 'VERSION_CONFLICT');
    expect(conflict.currentVersion).toBe('3');
    await expectApiError(ctx.api.call('applyMeal', { params: { mealId: M.pastSupper }, body: { message: 'I would love to join this table please.' }, idempotencyKey: newId() }), 409, 'DEADLINE_PASSED');

    const precondition = await ctx.backend.fetch(`${BASE}/v1/me`, { method: 'PATCH', headers: { authorization: `Bearer ${ctx.session.accessToken()}`, 'content-type': 'application/json', 'idempotency-key': newId() }, body: JSON.stringify({ displayName: 'Alexandra' }) });
    expect(precondition.status).toBe(428);
    const badJson = await ctx.backend.fetch(`${BASE}/v1/auth/email/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    expect((await badJson.json()).error.code).toBe('INVALID_REQUEST');

    const key = newId();
    const first = await ctx.api.call('updateMe', { body: { displayName: 'Alexandra' }, ifMatch: '3', idempotencyKey: key });
    const replay = await ctx.api.call('updateMe', { body: { displayName: 'Alexandra' }, ifMatch: '3', idempotencyKey: key });
    expect(replay).toEqual(first);
    await expectApiError(ctx.api.call('updateMe', { body: { displayName: 'Someone else' }, ifMatch: '3', idempotencyKey: key }), 409, 'IDEMPOTENCY_CONFLICT');
    await expectApiError(ctx.api.call('updateMe', { body: { ageConfirmedVersion: '1999-01-01' }, ifMatch: '4', idempotencyKey: newId() }), 422, 'VALIDATION_FAILED');
    await expectApiError(ctx.api.call('readAIPreferences', {}), 503, 'AI_UNAVAILABLE');
    expect(ctx.problems).toEqual([]);
  });

  it('advances meal lifecycles with the business clock', async () => {
    const ctx = setup();
    await signIn(ctx);
    ctx.clock.t = Date.parse('2026-10-23T20:00:00.000Z'); // Fri 21:00 BST: the supper's scheduled end
    const supper = (await ctx.api.call('getMeal', { params: { mealId: M.supper } })).data.meal;
    expect(supper.status).toBe('COMPLETED');
    expect((await ctx.api.call('discoverMeals', { query: {} })).data.map((m) => m.id)).toEqual([M.duo, M.sohoSaturday, M.tapas]);
    ctx.clock.t = Date.parse('2026-10-24T11:31:00.000Z'); // after the duo lunch closed (12:30 BST − 60 min) with one seat
    const duo = (await ctx.api.call('getMeal', { params: { mealId: M.duo } })).data.meal;
    expect(duo).toMatchObject({ status: 'CANCELLED', cancelReason: 'insufficient', allowedActions: [] });
    expect(ctx.problems).toEqual([]);
  });
});
