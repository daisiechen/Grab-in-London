/**
 * Preview mode backend: an in-memory implementation of the user-facing Fancy API that answers the
 * requests `createApiClient` (packages/client) sends to `${baseUrl}/v1/...`, so the iOS app is fully
 * clickable with no server. Request validation, auth, If-Match, Idempotency-Key, status codes,
 * envelopes and DTO projections follow packages/contracts; state machines follow apps/api.
 *
 * Business rules follow PRD r07: no platform deposit, payment, refund or platform-made reservation.
 * Hosts self-report an external booking; guests pay the restaurant (bookingMode EXTERNAL_PAY_AT_VENUE).
 *
 * Preview conveniences (not production behaviour):
 * - Email sign-in accepts any address and any six-digit code (use 000000); the account is always the
 *   demo's "Alex". Bearer tokens are recognised by prefix, so a reloaded app stays signed in.
 * - Applications Alex sends to a seeded host are approved by that host after `autoApproveAfterMs`.
 * - A meal Alex publishes receives Emma's request (the demo's host "Requests" card).
 * - Reconnecting with Maya after the past supper becomes mutual (she already chose Alex).
 */
import type { RequestOf, ResponseOf } from '@fancy/client';
import { ERROR_STATUS, operationsById, type ErrorCode, type OperationDef, type OperationId } from '@fancy/contracts';
import { londonInstant, londonTime, resolveLondonTime, type TimeInput } from './london-time.ts';
import {
  DIRECT_OPENER, EMMA_REPLY, EMMA_REQUEST, HOST_GREETING, PREVIEW_CONSENT_VERSION, PREVIEW_IDS, PREVIEW_NOW, SEED_MEALS, SEED_PEOPLE,
  SEED_REFERENCES, SEED_VENUES, previewImageUrl, seedId, type PersonKey, type SeedVenue,
} from './seed.ts';
import { coerceStrings, validate } from './validate.ts';

export { PREVIEW_IDS, PREVIEW_NOW, previewImageKey, previewImageUrl } from './seed.ts';

export interface PreviewOptions {
  /** Business clock. Default: starts at the demo clock (Tue 20 Oct 2026 10:00 London) and ticks in real time. */
  now?: () => number;
  /** Simulated network latency per request (default 120 ms; use 0 in tests). */
  latencyMs?: number;
  /** Seeded hosts approve Alex's applications this long after they are sent; null disables (default 8 s). */
  autoApproveAfterMs?: number | null;
  /** Google/Apple sign-in: 'unavailable' answers PROVIDER_UNAVAILABLE (default); 'simulate' completes a fake round trip. */
  oauth?: 'unavailable' | 'simulate';
}

export interface PreviewBackend {
  fetch: typeof fetch;
  /** The business clock the fake uses (pass it to the app's `now` so "today" matches). */
  now: () => number;
  /** Restores the seed (keeps issued tokens valid). */
  reset(): void;
}

// ───────────────────────────── state ─────────────────────────────

type Mood = MealDto['mood'];
type MealDto = DataOf<'getMeal'>['meal'];
type ApplicationDto = DataOf<'applyMeal'>;
type PublicProfileDto = MealDto['host'];
type ConversationDto = DataOf<'leaveGroup'>;
type MessageDto = DataOf<'sendMessage'>;
type MeDto = DataOf<'getMe'>;
type AttendanceDto = DataOf<'reportAttendance'>;
type ReconnectDto = DataOf<'selectReconnect'>;
type DataOf<I extends OperationId> = ResponseOf<I> extends { data: infer D } ? D : undefined;
type BodyOf<I extends OperationId> = NonNullable<RequestOf<I>['body']>;
type ParamsOf<I extends OperationId> = NonNullable<RequestOf<I>['params']>;
type QueryOf<I extends OperationId> = NonNullable<RequestOf<I>['query']>;

interface UserRec {
  id: string;
  version: number;
  displayName: string | null;
  avatarRef: string | null;
  bio: string | null;
  languages: MeDto['languages'];
  lifeStatus: MeDto['lifeStatus'];
  interests: MeDto['interests'];
  background: MeDto['background'];
  email: string | null;
  ageConfirmedVersion: string | null;
  communityAcceptedVersion: string | null;
}
interface SeatEvent { userId: string; type: 'HOST_CONFIRMED' | 'GUEST_CONFIRMED' | 'LEFT'; at: number; seq: number }
interface Declaration { id: string; revision: number; status: NonNullable<MealDto['bookingDeclaration']>['status']; count: number; reportedAt: number; key: string }
interface MealRec {
  id: string;
  version: number;
  hostId: string;
  venueRef: string;
  title: string;
  description: string;
  startMs: number;
  closeMs: number;
  endMs: number;
  minimum: number;
  capacity: number;
  budgetMinPence: number;
  budgetMaxPence: number;
  languages: MealDto['languages'];
  mood: Mood;
  areaCode: string;
  cuisineCode: MealDto['cuisineCode'];
  dietaryCodes: MealDto['dietaryCodes'];
  status: MealDto['status'];
  cancelReason: MealDto['cancelReason'];
  lockedAt: number | null;
  seats: SeatEvent[];
  seatSeq: number;
  declarations: Declaration[];
  conversationId: string | null;
  attemptId: string | null;
  marks: { close: boolean; start: boolean; end: boolean };
  startRoster: string[] | null;
}
interface AppRec { id: string; mealId: string; userId: string; round: number; state: ApplicationDto['state']; version: number; createdAt: number; decidedAt: number | null; message: string }
interface Interval { userId: string; join: number; leave: number | null }
interface MsgRec { id: string; seq: number; senderId: string; body: string; createdAt: number; clientMessageId: string | null }
interface ConvRec {
  id: string; kind: 'GROUP' | 'DIRECT'; mealId: string | null; pair: [string, string] | null; version: number; head: number;
  dissolvedAt: number | null; intervals: Interval[]; messages: MsgRec[]; reads: Map<string, number>; createdAt: number;
}
interface AttendanceRev { source: 'SELF' | 'HOST' | 'SUPPORT'; value: 'present' | 'absent'; version: number }
interface Consent { revision: number; active: boolean }
interface PairRec { users: [string, string]; consents: Map<string, Consent> }
interface ReviewRec { id: string; mealId: string; authorId: string; subjectId: string; body: string; revision: number; createdAt: number }
interface NotificationRec { id: string; userId: string; template: string; createdAt: number; readAt: number | null; mealId: string | null; applicationId: string | null; conversationId: string | null }
interface ReportRec { id: string; userId: string; receipt: string; targetType: 'USER' | 'MEAL' | 'MESSAGE'; createdAt: number }

interface World {
  users: Map<string, UserRec>;
  venues: Map<string, SeedVenue>;
  meals: Map<string, MealRec>;
  applications: Map<string, AppRec>;
  conversations: Map<string, ConvRec>;
  attendance: Map<string, AttendanceRev[]>;
  experiences: Map<string, { score: number; revision: number }>;
  reviews: ReviewRec[];
  pairs: Map<string, PairRec>;
  blocks: Map<string, { active: boolean; version: number }>;
  survey: { version: number; again: boolean | null; reasons: DataOf<'getSurvey'>['reasons']; submittedAt: number | null };
  notifications: NotificationRec[];
  reports: Map<string, ReportRec>;
  idempotency: Map<string, { hash: string; status: number; body: unknown }>;
  counter: number;
}

const ALEX = PREVIEW_IDS.users.alex;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const POST_MEAL_WINDOW_MS = 7 * DAY;
const userId = (key: PersonKey) => PREVIEW_IDS.users[key];

class PreviewError extends Error {
  readonly code: ErrorCode;
  readonly extra: Record<string, unknown>;
  constructor(code: ErrorCode, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.extra = extra;
  }
}
const fail = (code: ErrorCode, message: string, extra: Record<string, unknown> = {}): never => {
  throw new PreviewError(code, message, extra);
};

// ───────────────────────────── seed ─────────────────────────────

function seedWorld(now: number): World {
  const w: World = {
    users: new Map(), venues: new Map(), meals: new Map(), applications: new Map(), conversations: new Map(), attendance: new Map(),
    experiences: new Map(), reviews: [], pairs: new Map(), blocks: new Map(),
    survey: { version: 0, again: null, reasons: [], submittedAt: null }, notifications: [], reports: new Map(), idempotency: new Map(), counter: 100,
  };
  for (const p of SEED_PEOPLE) {
    w.users.set(userId(p.key), {
      id: userId(p.key), version: 3, displayName: p.displayName, avatarRef: `avatar:${p.image}`, bio: p.bio, languages: [...p.languages],
      lifeStatus: p.lifeStatus, interests: [...p.interests], background: { work: p.work }, email: p.key === 'alex' ? 'alex@example.com' : null,
      ageConfirmedVersion: PREVIEW_CONSENT_VERSION, communityAcceptedVersion: PREVIEW_CONSENT_VERSION,
    });
  }
  for (const v of SEED_VENUES) w.venues.set(v.venueRef, v);
  let appN = 0;
  let convN = 0;
  for (const s of SEED_MEALS) {
    const startMs = londonInstant(s.localDate, s.localTime);
    const venue = w.venues.get(s.venueRef)!;
    // Seats were taken a few days before the meal, all before "now" for upcoming meals.
    const createdAt = Math.min(startMs, now) - 5 * DAY;
    const meal: MealRec = {
      id: s.id, version: 1, hostId: userId(s.host), venueRef: s.venueRef, title: s.title, description: s.description, startMs,
      closeMs: startMs - HOUR, endMs: startMs + 2 * HOUR, minimum: s.minimum, capacity: s.capacity, budgetMinPence: s.budgetMinPence,
      budgetMaxPence: s.budgetMaxPence, languages: [...s.languages], mood: s.mood, areaCode: venue.areaCode, cuisineCode: s.cuisineCode,
      dietaryCodes: s.dietaryCodes ? [...s.dietaryCodes] : null, status: 'OPEN', cancelReason: null, lockedAt: null, seats: [], seatSeq: 0,
      declarations: [], conversationId: null, attemptId: null, marks: { close: false, start: false, end: false }, startRoster: null,
    };
    w.meals.set(meal.id, meal);
    addSeat(meal, meal.hostId, 'HOST_CONFIRMED', createdAt);
    const conv = newConversation(w, seedId('conversation', ++convN), 'GROUP', meal.id, null, createdAt);
    meal.conversationId = conv.id;
    joinConversation(conv, meal.hostId, createdAt);
    s.guests.forEach((guest, i) => {
      const at = createdAt + (i + 1) * HOUR;
      const app: AppRec = { id: seedId('application', ++appN), mealId: meal.id, userId: userId(guest), round: 1, state: 'CONFIRMED', version: 2, createdAt: at - 30 * MINUTE, decidedAt: at, message: 'I’d love to join — a relaxed meal with new people sounds perfect.' };
      w.applications.set(app.id, app);
      addSeat(meal, app.userId, 'GUEST_CONFIRMED', at);
      meal.lockedAt ??= at;
      meal.version += 1;
      joinConversation(conv, app.userId, at);
    });
    if (s.bookingReported) {
      meal.declarations.push({ id: seedId('misc', 1000 + w.meals.size), revision: 1, status: 'REPORTED_CONFIRMED', count: s.capacity, reportedAt: createdAt + DAY, key: arrangementKey(meal, s.capacity, meal.seatSeq) });
    }
  }
  // Past supper (demo "past-supper"): group chat lines, host-reported attendance, references, Maya's reconnect choice.
  const past = w.meals.get(PREVIEW_IDS.meals.pastSupper)!;
  const pastConv = w.conversations.get(past.conversationId!)!;
  postMessage(pastConv, userId('maya'), HOST_GREETING, past.startMs - 2 * DAY, null, w);
  postMessage(pastConv, userId('emma'), EMMA_REPLY, past.startMs - 2 * DAY + 20 * MINUTE, null, w);
  w.attendance.set(`${past.id}:${userId('maya')}`, [{ source: 'HOST', value: 'present', version: 1 }]);
  w.attendance.set(`${past.id}:${userId('emma')}`, [{ source: 'HOST', value: 'present', version: 1 }]);
  SEED_REFERENCES.forEach((r, i) => w.reviews.push({ id: seedId('misc', 2000 + i), mealId: past.id, authorId: userId(r.author), subjectId: userId(r.subject), body: r.body, revision: 1, createdAt: past.endMs + (i + 1) * HOUR }));
  pairOf(w, userId('maya'), ALEX).consents.set(userId('maya'), { revision: 1, active: true });
  return w;
}

// ───────────────────────────── domain helpers ─────────────────────────────

const iso = (ms: number) => new Date(ms).toISOString();

function newId(w: World, kind: Parameters<typeof seedId>[0]): string {
  w.counter += 1;
  return seedId(kind, w.counter);
}

function addSeat(meal: MealRec, user: string, type: SeatEvent['type'], at: number) {
  meal.seatSeq += 1;
  meal.seats.push({ userId: user, type, at, seq: meal.seatSeq });
}

/** Confirmation is strict, exit inclusive (apps/api rosterAt). */
function rosterAt(seats: readonly SeatEvent[], at: number): string[] {
  const active = new Set<string>();
  for (const e of [...seats].sort((a, b) => a.at - b.at || a.seq - b.seq)) {
    if (e.type === 'LEFT' ? e.at <= at : e.at < at) {
      if (e.type === 'LEFT') active.delete(e.userId);
      else active.add(e.userId);
    }
  }
  return [...active].sort();
}
const currentSeats = (meal: MealRec, now: number) => rosterAt(meal.seats, now + 1);

/** A self-reported booking goes stale when the roster or arrangement changes after it (apps/api arrangementHash). */
function arrangementKey(meal: MealRec, count: number, seatRevision: number): string {
  return JSON.stringify([seatRevision, meal.venueRef, meal.title, meal.description, meal.startMs, meal.closeMs, meal.minimum, meal.capacity, meal.budgetMinPence, meal.budgetMaxPence, meal.languages, meal.mood, meal.cuisineCode, meal.dietaryCodes, count]);
}

function newConversation(w: World, id: string, kind: ConvRec['kind'], mealId: string | null, pair: [string, string] | null, at: number): ConvRec {
  const conv: ConvRec = { id, kind, mealId, pair, version: 1, head: 0, dissolvedAt: null, intervals: [], messages: [], reads: new Map(), createdAt: at };
  w.conversations.set(id, conv);
  return conv;
}
function allocate(conv: ConvRec, kind: 'JOIN' | 'LEAVE' | 'DISSOLVE' | 'MESSAGE'): number {
  conv.head += 1;
  if (kind !== 'MESSAGE') conv.version += 1;
  return conv.head;
}
const openInterval = (conv: ConvRec, user: string) => conv.intervals.find((i) => i.userId === user && i.leave === null);
const isMember = (conv: ConvRec, user: string) => conv.intervals.some((i) => i.userId === user);
const visibleTo = (conv: ConvRec, user: string, seq: number) => conv.intervals.some((i) => i.userId === user && i.join < seq && (i.leave === null || seq < i.leave));

function joinConversation(conv: ConvRec, user: string, _at: number) {
  if (conv.dissolvedAt !== null) fail('STATE_CONFLICT', 'This group has been dissolved.');
  if (openInterval(conv, user)) return;
  conv.intervals.push({ userId: user, join: allocate(conv, 'JOIN'), leave: null });
}
function postMessage(conv: ConvRec, sender: string, body: string, at: number, clientMessageId: string | null, w: World): MsgRec {
  const msg: MsgRec = { id: newId(w, 'message'), seq: allocate(conv, 'MESSAGE'), senderId: sender, body, createdAt: at, clientMessageId };
  conv.messages.push(msg);
  return msg;
}

const pairKey = (a: string, b: string) => [a, b].sort().join(':');
function pairOf(w: World, a: string, b: string): PairRec {
  const key = pairKey(a, b);
  let pair = w.pairs.get(key);
  if (!pair) {
    pair = { users: [a, b].sort() as [string, string], consents: new Map() };
    w.pairs.set(key, pair);
  }
  return pair;
}

// ───────────────────────────── backend ─────────────────────────────

export function createPreviewFetch(opts: PreviewOptions = {}): typeof fetch {
  return createPreviewBackend(opts).fetch;
}

export function createPreviewBackend(opts: PreviewOptions = {}): PreviewBackend {
  const startedAt = Date.now();
  const now = opts.now ?? (() => PREVIEW_NOW + (Date.now() - startedAt));
  const latencyMs = opts.latencyMs ?? 120;
  const autoApproveAfterMs = opts.autoApproveAfterMs === undefined ? 8_000 : opts.autoApproveAfterMs;
  const oauthMode = opts.oauth ?? 'unavailable';

  let w = seedWorld(now());
  let requestCounter = 0;
  let tokenCounter = 0;
  // Auth state survives reset() so an open app keeps its session.
  const challenges = new Map<string, { email: string; used: boolean; client: string }>();
  const handoffs = new Map<string, { used: boolean }>();
  const oauthStates = new Map<string, { used: boolean }>();
  const revoked = new Set<string>();
  const deletions = new Map<string, { requestedAt: number }>();
  let authTime = now();
  let deleted = false;

  /** Expiries the client compares with its own clock: valid against both the business and device clocks. */
  const issueBase = () => Math.max(now(), Date.now());
  const token = (kind: string) => {
    tokenCounter += 1;
    let random = '';
    while (random.length < 32) random += Math.random().toString(36).slice(2);
    return `pv_${kind}_${tokenCounter}_${random.slice(0, 32)}`;
  };
  const credentials = () => ({
    client: 'IOS' as const,
    accessToken: token('access'),
    accessExpiresAt: iso(issueBase() + 15 * MINUTE),
    refreshToken: token('refresh'),
    refreshExpiresAt: iso(issueBase() + 30 * DAY),
  });
  const authProof = () => newId(w, 'misc');

  // ── projections ──
  const user = (id: string) => w.users.get(id) ?? fail('NOT_FOUND', 'This member is unavailable.');

  function publicProfile(id: string): PublicProfileDto {
    const u = user(id);
    const background: PublicProfileDto['background'] = {};
    if (u.background.work) background.work = u.background.work;
    if (u.background.school) background.school = u.background.school;
    if (u.background.hometown) background.hometown = u.background.hometown;
    return {
      id, displayName: u.displayName ?? 'Fancy member', avatarUrl: u.avatarRef ? previewImageUrl(u.avatarRef.slice('avatar:'.length)) : null,
      bio: u.bio, interests: [...u.interests], languages: [...u.languages], background,
    };
  }

  function meDto(id: string): MeDto {
    const u = user(id);
    const ageConfirmed = u.ageConfirmedVersion === PREVIEW_CONSENT_VERSION;
    const communityAccepted = u.communityAcceptedVersion === PREVIEW_CONSENT_VERSION;
    const missing: MeDto['profileGate']['missing'] = [
      ...(!u.displayName ? (['displayName'] as const) : []), ...(!u.bio ? (['bio'] as const) : []),
      ...(!u.languages.length ? (['languages'] as const) : []), ...(!u.lifeStatus ? (['lifeStatus'] as const) : []),
      ...(!u.interests.length ? (['interests'] as const) : []), ...(!ageConfirmed ? (['age'] as const) : []),
      ...(!communityAccepted ? (['community'] as const) : []),
    ];
    return {
      id, version: String(u.version), displayName: u.displayName, avatarRef: u.avatarRef, bio: u.bio, languages: [...u.languages],
      lifeStatus: u.lifeStatus, interests: [...u.interests], background: { ...u.background }, email: u.email,
      ageConfirmedVersion: u.ageConfirmedVersion, communityAcceptedVersion: u.communityAcceptedVersion,
      profileGate: { ageConfirmed, communityAccepted, profileComplete: missing.length === 0, missing }, roles: [],
    };
  }

  function venueDto(ref: string): MealDto['venue'] {
    const v = w.venues.get(ref);
    if (!v) return { venueRef: ref, placeId: 'unavailable', available: false, name: null, address: null, location: null, areaCode: 'unknown', attributions: [], displayExpiresAt: null };
    return { venueRef: v.venueRef, placeId: v.placeId, available: true, name: v.name, address: v.address, location: { lat: v.lat, lng: v.lng }, areaCode: v.areaCode, attributions: [], displayExpiresAt: null };
  }

  function applicationsOf(mealId: string, uid: string) {
    return [...w.applications.values()].filter((a) => a.mealId === mealId && a.userId === uid).sort((a, b) => b.round - a.round);
  }

  function mealDto(meal: MealRec, viewer: string | null): MealDto {
    const t = now();
    const count = currentSeats(meal, t).length;
    const conv = meal.conversationId ? w.conversations.get(meal.conversationId) : undefined;
    const mine = viewer ? applicationsOf(meal.id, viewer) : [];
    const actions: MealDto['allowedActions'] = [];
    if (viewer && conv && isMember(conv, viewer)) actions.push('OPEN_GROUP');
    if (meal.status === 'OPEN' && t < meal.startMs) {
      if (viewer === meal.hostId) {
        actions.push('CANCEL', 'DECLARE_BOOKING', 'REVIEW_APPLICATIONS');
        if (meal.lockedAt === null && t < meal.closeMs) actions.push('EDIT');
      } else if (viewer) {
        if (mine[0]?.state === 'PENDING') actions.push('WITHDRAW');
        else if (mine[0]?.state === 'CONFIRMED') actions.push('LEAVE');
        else if (t < meal.closeMs && count < meal.capacity && !mine.some((a) => a.state === 'DECLINED')) actions.push('APPLY');
      }
    }
    if (viewer && meal.status === 'COMPLETED' && meal.startRoster?.includes(viewer)) actions.push('POST_MEAL');
    const d = meal.declarations.at(-1);
    return {
      id: meal.id, version: String(meal.version), host: publicProfile(meal.hostId), venue: venueDto(meal.venueRef), title: meal.title, description: meal.description,
      startsAt: londonTime(meal.startMs), closesAt: londonTime(meal.closeMs), scheduledEndAt: iso(meal.endMs), minimum: meal.minimum, capacity: meal.capacity,
      confirmedCount: count, budgetMinPence: meal.budgetMinPence, budgetMaxPence: meal.budgetMaxPence, currency: 'GBP', languages: [...meal.languages],
      mood: meal.mood, areaCode: meal.areaCode, cuisineCode: meal.cuisineCode, dietaryCodes: meal.dietaryCodes ? [...meal.dietaryCodes] : null,
      declarationSource: 'host_reported', bookingMode: 'EXTERNAL_PAY_AT_VENUE', status: meal.status, cancelReason: meal.cancelReason,
      arrangementLocked: meal.lockedAt !== null,
      bookingDeclaration: d ? { id: d.id, revision: String(d.revision), status: d.status, declaredCount: d.count, reportedAt: iso(d.reportedAt), stale: d.key !== arrangementKey(meal, d.count, meal.seatSeq) } : null,
      allowedActions: actions,
    };
  }

  function applicationDto(a: AppRec): ApplicationDto {
    return {
      id: a.id, mealId: a.mealId, version: String(a.version), round: a.round, state: a.state, createdAt: iso(a.createdAt),
      ...(a.decidedAt !== null ? { decidedAt: iso(a.decidedAt) } : {}), applicant: publicProfile(a.userId), message: a.message,
    };
  }

  function directAuthorized(pair: PairRec): boolean {
    const [a, b] = pair.users;
    if (!pair.consents.get(a)?.active || !pair.consents.get(b)?.active) return false;
    if (w.blocks.get(`${a}:${b}`)?.active || w.blocks.get(`${b}:${a}`)?.active) return false;
    return validSharedMeals(pair).length > 0;
  }
  function validSharedMeals(pair: PairRec): string[] {
    return [...w.meals.values()].filter((m) => isPresent(m.id, pair.users[0]) && isPresent(m.id, pair.users[1])).map((m) => m.id);
  }
  function convTitle(conv: ConvRec, viewer: string): string {
    if (conv.kind === 'GROUP') return w.meals.get(conv.mealId ?? '')?.title ?? 'Conversation';
    const peer = conv.pair?.find((id) => id !== viewer);
    return peer ? (w.users.get(peer)?.displayName ?? 'Fancy member') : 'Conversation';
  }
  function canSend(conv: ConvRec, viewer: string): boolean {
    if (conv.dissolvedAt !== null || !openInterval(conv, viewer)) return false;
    if (conv.kind === 'DIRECT') return conv.pair ? directAuthorized(pairOf(w, conv.pair[0], conv.pair[1])) : false;
    return true;
  }
  function convDto(conv: ConvRec, viewer: string, send = canSend(conv, viewer)): ConversationDto {
    return { id: conv.id, version: String(conv.version), kind: conv.kind, mealId: conv.mealId, title: convTitle(conv, viewer).slice(0, 120), canSend: send, dissolved: conv.dissolvedAt !== null, head: String(conv.head) };
  }
  function messageDto(m: MsgRec): MessageDto {
    return { id: m.id, seq: String(m.seq), sender: publicProfile(m.senderId), body: m.body, createdAt: iso(m.createdAt), redacted: false };
  }

  function attendanceState(mealId: string, subjectId: string): AttendanceDto {
    const revs = w.attendance.get(`${mealId}:${subjectId}`) ?? [];
    const latest = (source: AttendanceRev['source']) => revs.filter((r) => r.source === source).sort((a, b) => b.version - a.version)[0];
    const self = latest('SELF'), host = latest('HOST'), support = latest('SUPPORT');
    const effective = support ?? self ?? host;
    return {
      subjectId, value: effective?.value ?? 'unknown', source: effective?.source ?? null, selfValue: self?.value ?? null, hostValue: host?.value ?? null,
      version: String(revs.reduce((max, r) => Math.max(max, r.version), 0)),
    };
  }
  function isPresent(mealId: string, uid: string): boolean {
    const meal = w.meals.get(mealId);
    return !!meal && meal.status !== 'CANCELLED' && !!meal.startRoster?.includes(uid) && attendanceState(mealId, uid).value === 'present';
  }
  function connectionState(pair: PairRec, actor: string, subjectId: string): ReconnectDto {
    const consent = pair.consents.get(actor);
    const selected = !!consent?.active;
    const open = directAuthorized(pair);
    return { subjectId, selected, version: String(consent?.revision ?? 0), connection: open ? 'OPEN' : selected ? 'WAITING' : 'CLOSED' };
  }
  function clearConsents(pair: PairRec) {
    for (const consent of pair.consents.values()) if (consent.active) {
      consent.active = false;
      consent.revision += 1;
    }
  }
  function reviewVisibility(r: ReviewRec, t: number): 'PENDING' | 'PUBLISHED' | 'WITHDRAWN' {
    const meal = w.meals.get(r.mealId);
    if (!meal || meal.status === 'CANCELLED' || !isPresent(r.mealId, r.authorId) || !isPresent(r.mealId, r.subjectId)) return 'WITHDRAWN';
    const reciprocal = w.reviews.some((x) => x.mealId === r.mealId && x.authorId === r.subjectId && x.subjectId === r.authorId);
    return reciprocal || t >= meal.endMs + POST_MEAL_WINDOW_MS ? 'PUBLISHED' : 'PENDING';
  }
  function reviewPublishAt(r: ReviewRec): number {
    const meal = w.meals.get(r.mealId)!;
    const deadline = meal.endMs + POST_MEAL_WINDOW_MS;
    const reciprocal = w.reviews.find((x) => x.mealId === r.mealId && x.authorId === r.subjectId && x.subjectId === r.authorId);
    return reciprocal ? Math.min(deadline, Math.max(r.createdAt, reciprocal.createdAt)) : deadline;
  }

  function notify(uid: string, template: string, refs: { mealId?: string; applicationId?: string; conversationId?: string }, at: number) {
    if (uid !== ALEX) return;
    w.notifications.push({ id: newId(w, 'misc'), userId: uid, template, createdAt: at, readAt: null, mealId: refs.mealId ?? null, applicationId: refs.applicationId ?? null, conversationId: refs.conversationId ?? null });
  }

  // ── commands shared by handlers and the simulated hosts ──
  function cancelState(meal: MealRec, reason: NonNullable<MealDto['cancelReason']>, at: number) {
    if (meal.status === 'CANCELLED') return;
    meal.status = 'CANCELLED';
    meal.cancelReason = reason;
    meal.version += 1;
    for (const a of w.applications.values()) if (a.mealId === meal.id && a.state === 'PENDING') expire(a, at);
    notify(ALEX, 'meal_cancelled', { mealId: meal.id }, at);
  }
  function expire(a: AppRec, at: number) {
    a.state = 'EXPIRED';
    a.version += 1;
    a.decidedAt = at;
  }
  function approve(meal: MealRec, a: AppRec, at: number) {
    a.state = 'CONFIRMED';
    a.version += 1;
    a.decidedAt = at;
    addSeat(meal, a.userId, 'GUEST_CONFIRMED', at);
    meal.lockedAt ??= at;
    meal.version += 1;
    const conv = meal.conversationId ? w.conversations.get(meal.conversationId) : undefined;
    if (conv && conv.dissolvedAt === null) {
      joinConversation(conv, a.userId, at);
      // demo group chat: the host greets the newcomer; Emma (when at the table) replies.
      if (meal.hostId !== ALEX) postMessage(conv, meal.hostId, HOST_GREETING, at + 1_000, null, w);
      const emma = userId('emma');
      if (isMember(conv, emma) && meal.hostId !== emma && openInterval(conv, emma)) postMessage(conv, emma, EMMA_REPLY, at + 2_000, null, w);
    }
    notify(a.userId, 'application_approved', { mealId: meal.id, applicationId: a.id, ...(conv ? { conversationId: conv.id } : {}) }, at);
  }

  /** Lazily materialises time-driven transitions (simulated host decisions, close/start/end), like apps/api advanceLifecycle. */
  function tick() {
    const t = now();
    if (autoApproveAfterMs !== null) {
      for (const a of [...w.applications.values()].sort((x, y) => x.createdAt - y.createdAt)) {
        const meal = w.meals.get(a.mealId);
        const due = a.createdAt + autoApproveAfterMs;
        if (!meal || a.state !== 'PENDING' || a.userId !== ALEX || meal.hostId === ALEX || t < due) continue;
        if (meal.status === 'OPEN' && due < meal.closeMs && currentSeats(meal, due).length < meal.capacity) approve(meal, a, due);
      }
    }
    for (const meal of w.meals.values()) {
      for (const kind of ['close', 'start', 'end'] as const) {
        const due = kind === 'close' ? meal.closeMs : kind === 'start' ? meal.startMs : meal.endMs;
        if (meal.status !== 'OPEN' || t < due) break;
        if (meal.marks[kind]) continue;
        meal.marks[kind] = true;
        if (kind === 'close') {
          if (rosterAt(meal.seats, due).length < meal.minimum) {
            cancelState(meal, 'insufficient', due);
            break;
          }
          for (const a of w.applications.values()) if (a.mealId === meal.id && a.state === 'PENDING') {
            expire(a, due);
            notify(a.userId, 'application_expired', { mealId: meal.id, applicationId: a.id }, due);
          }
        }
        if (kind === 'start') meal.startRoster = rosterAt(meal.seats, due);
        if (kind === 'end') {
          meal.status = 'COMPLETED';
          meal.version += 1;
        }
      }
    }
  }

  // ── guards ──
  const mealOr404 = (id: string) => w.meals.get(id) ?? fail('NOT_FOUND', 'Meal not found.');
  const checkVersion = (actual: number, expected: string | null, message = 'This meal has changed. Refresh and try again.') => {
    if (String(actual) !== expected) fail('VERSION_CONFLICT', message, { currentVersion: String(actual) });
  };
  const openMeal = (meal: MealRec) => {
    if (meal.status === 'CANCELLED') fail('MEAL_CANCELLED', 'This meal was cancelled.');
    if (meal.status !== 'OPEN') fail('DEADLINE_PASSED', 'This meal has ended.');
  };
  const requireProfile = (uid: string) => {
    if (!meDto(uid).profileGate.profileComplete) fail('PROFILE_INCOMPLETE', 'Complete your profile before continuing.');
  };
  const resolveTime = (input: TimeInput) => {
    const z = resolveLondonTime(input);
    if ('instant' in z) return z;
    if (z.code === 'TIME_AMBIGUOUS') return fail('TIME_AMBIGUOUS', 'Choose BST or GMT for this repeated time.', { choices: z.choices });
    if (z.code === 'TIME_NONEXISTENT') return fail('TIME_NONEXISTENT', 'This local time does not exist. Choose another time.');
    if (z.code === 'INVALID_OFFSET') return fail('INVALID_OFFSET', 'The selected offset does not match London time.');
    return fail('VALIDATION_FAILED', 'Invalid London date/time.');
  };
  function validateArrangement(input: { title: string; description: string; start: TimeInput; close: TimeInput; minimum: number; capacity: number; budgetMinPence: number; budgetMaxPence: number }) {
    const t = now();
    const title = [...input.title.trim()].length, description = [...input.description.trim()].length;
    if (title < 5 || title > 80 || description < 20 || description > 1000) fail('VALIDATION_FAILED', 'Check the title and description length.');
    const start = resolveTime(input.start), close = resolveTime(input.close);
    if (Date.parse(start.instant) <= t || Date.parse(close.instant) <= t) fail('VALIDATION_FAILED', 'Choose a future start and application deadline.');
    if (Date.parse(close.instant) > Date.parse(start.instant) - 30 * MINUTE) fail('VALIDATION_FAILED', 'Applications must close at least 30 minutes before the meal.');
    if (input.minimum > input.capacity || input.budgetMaxPence < input.budgetMinPence) fail('VALIDATION_FAILED', 'Check the table size and budget range.');
    return { startMs: Date.parse(start.instant), closeMs: Date.parse(close.instant) };
  }
  function paginate<T>(items: readonly T[], cursor: string | undefined, limit: number | undefined) {
    let offset = 0;
    if (cursor !== undefined) {
      const m = /^o(\d{1,6})$/.exec(cursor);
      if (!m) fail('VALIDATION_FAILED', 'Invalid page cursor.');
      offset = Number(m![1]);
    }
    const n = limit ?? 20;
    const hasMore = items.length > offset + n;
    return { data: items.slice(offset, offset + n), page: { hasMore, nextCursor: hasMore ? `o${offset + n}` : null } };
  }
  const convFor = (id: string, uid: string) => {
    const conv = w.conversations.get(id);
    if (!conv || !isMember(conv, uid)) return fail('NOT_FOUND', 'Conversation not found.');
    return conv;
  };
  const liveConv = (conv: ConvRec, uid: string) => {
    if (conv.dissolvedAt !== null || !openInterval(conv, uid)) fail('FORBIDDEN', 'This conversation is read-only.');
    if (conv.kind === 'DIRECT' && (!conv.pair || !directAuthorized(pairOf(w, conv.pair[0], conv.pair[1])))) fail('CONNECTION_NOT_AUTHORIZED', 'This conversation is currently read-only.');
  };
  const assertWindow = (meal: MealRec) => {
    const t = now();
    if (meal.status === 'CANCELLED' || t < meal.endMs || t >= meal.endMs + POST_MEAL_WINDOW_MS) fail('STATE_CONFLICT', 'The post-meal reporting window is closed.');
  };
  const assertRoster = (meal: MealRec, ids: string[]) => {
    if (!ids.every((id) => meal.startRoster?.includes(id))) fail('FORBIDDEN', 'Only the meal start roster can use this action.');
  };
  const otherMember = (actor: string, subjectId: string) => {
    if (actor === subjectId) fail('FORBIDDEN', 'Choose another meal member.');
    if (!w.users.has(subjectId)) fail('NOT_FOUND', 'This member is unavailable.');
    return pairOf(w, actor, subjectId);
  };

  // ── handlers ──
  type Ctx<I extends OperationId> = { params: ParamsOf<I>; query: QueryOf<I>; body: BodyOf<I>; uid: string; viewer: string | null; ifMatch: string | null; headers: Record<string, string> };
  type Out<I extends OperationId> = { status?: number; data: DataOf<I>; page?: { nextCursor: string | null; hasMore: boolean; scannedThroughSeq?: string }; version?: string; headers?: Record<string, string> };
  type Handlers = { [I in OperationId]?: (ctx: Ctx<I>) => Out<I> };

  const newChallenge = (email: string, client: string) => {
    const id = newId(w, 'misc');
    challenges.set(id, { email, used: false, client });
    return id;
  };
  const authenticated = (client: string) => {
    const handoffCode = token('handoff');
    handoffs.set(handoffCode, { used: false });
    return client === 'IOS' || client === 'SUPPORT_CLI'
      ? { outcome: 'AUTHENTICATED' as const, handoffCode, authProof: authProof() }
      : { outcome: 'AUTHENTICATED' as const, session: sessionInfo(), authProof: authProof() };
  };
  const sessionInfo = (): DataOf<'getSession'> => ({ user: meDto(ALEX), authTime: iso(authTime), amr: ['otp'] });
  const signIn = (email: string | null) => {
    if (deleted) {
      w = seedWorld(now());
      deleted = false;
    }
    authTime = now();
    if (email) {
      const alex = user(ALEX);
      alex.email = email;
    }
  };

  const handlers: Handlers = {
    // ── auth ──
    startEmail: ({ body }) => {
      const challengeId = newChallenge(body.email, body.client);
      // Challenge times are compared with the app's business clock (services.now), unlike token expiries.
      return { data: { challengeId, expiresAt: iso(now() + 10 * MINUTE), resendAfter: iso(now() + 30_000) } };
    },
    verifyEmail: ({ body }) => {
      const challenge = challenges.get(body.challengeId) ?? fail('NOT_FOUND', 'This code has expired. Request a new code.');
      if (challenge.used) fail('STATE_CONFLICT', 'This code can no longer be used.');
      challenge.used = true;
      signIn(challenge.email);
      return { data: authenticated(challenge.client) };
    },
    startOAuth: ({ body }) => {
      if (oauthMode === 'unavailable') fail('PROVIDER_UNAVAILABLE', 'Google and Apple sign-in are not available in preview. Continue with email.');
      const state = newId(w, 'misc');
      oauthStates.set(state, { used: false });
      return { data: { authorizationUrl: `https://preview.fancy.invalid/oauth/${body.provider.toLowerCase()}?state=${state}`, stateTransactionId: state } };
    },
    oauthCallback: ({ query }) => {
      const state = oauthStates.get(query.state);
      if (!state || state.used) fail('STATE_CONFLICT', 'This sign-in can no longer be completed.');
      if (query.error) fail('FORBIDDEN', 'Sign-in was cancelled.');
      state!.used = true;
      signIn(null);
      return { data: authenticated('IOS') };
    },
    exchangeHandoff: ({ body }) => {
      const handoff = handoffs.get(body.code);
      if (!handoff || handoff.used) fail('STATE_CONFLICT', 'This sign-in can no longer be completed.');
      handoff!.used = true;
      return { data: credentials() };
    },
    refreshSession: ({ body }) => {
      if (!body.refreshToken.startsWith('pv_refresh_') || revoked.has(body.refreshToken) || deleted) fail('AUTH_REQUIRED', 'Please sign in again.');
      revoked.add(body.refreshToken);
      return { data: credentials() };
    },
    getSession: () => ({ data: sessionInfo() }),
    logout: ({ headers }) => {
      const bearer = /^Bearer (.+)$/.exec(headers.authorization ?? '')?.[1];
      if (bearer) revoked.add(bearer);
      return { status: 204, data: undefined };
    },
    startReauth: ({ body }) => {
      if (body.method === 'EMAIL') return { data: { challengeId: newChallenge(user(ALEX).email ?? 'alex@example.com', 'IOS'), expiresAt: iso(now() + 10 * MINUTE) } };
      if (oauthMode === 'unavailable') fail('PROVIDER_UNAVAILABLE', 'Google and Apple sign-in are not available in preview. Continue with email.');
      const state = newId(w, 'misc');
      oauthStates.set(state, { used: false });
      return { data: { authorizationUrl: `https://preview.fancy.invalid/oauth/${body.method.toLowerCase()}?state=${state}`, expiresAt: iso(issueBase() + 10 * MINUTE) } };
    },
    linkIdentity: () => fail('LINK_TICKET_INVALID', 'Account linking is not available in preview.'),

    // ── people ──
    getMe: ({ uid }) => {
      const data = meDto(uid);
      return { data, version: data.version };
    },
    updateMe: ({ uid, body, ifMatch }) => {
      const u = user(uid);
      checkVersion(u.version, ifMatch, 'Your profile changed. Reload it before saving.');
      for (const key of ['ageConfirmedVersion', 'communityAcceptedVersion'] as const) {
        if (body[key] !== undefined && body[key] !== PREVIEW_CONSENT_VERSION) fail('VALIDATION_FAILED', 'Please accept the current community and age confirmation.', { fieldErrors: { [`body.${key}`]: 'Unsupported consent version' } });
      }
      const name = body.displayName?.trim(), bio = body.bio?.trim();
      if (name !== undefined && (name.length < 2 || name.length > 40)) fail('VALIDATION_FAILED', 'Please check your profile.', { fieldErrors: { 'body.displayName': 'Use 2–40 characters' } });
      if (bio !== undefined && (bio.length < 20 || bio.length > 1000)) fail('VALIDATION_FAILED', 'Please check your profile.', { fieldErrors: { 'body.bio': 'Use 20–1000 characters' } });
      if (name !== undefined) u.displayName = name;
      if (body.avatarRef !== undefined) u.avatarRef = body.avatarRef;
      if (bio !== undefined) u.bio = bio;
      if (body.languages) u.languages = [...body.languages];
      if (body.lifeStatus) u.lifeStatus = body.lifeStatus;
      if (body.interests) u.interests = [...body.interests];
      if (body.background) {
        const bg: MeDto['background'] = {};
        for (const k of ['work', 'school', 'hometown'] as const) {
          const v = body.background[k]?.trim();
          if (v) bg[k] = v;
        }
        u.background = bg;
      }
      if (body.ageConfirmedVersion) u.ageConfirmedVersion = body.ageConfirmedVersion;
      if (body.communityAcceptedVersion) u.communityAcceptedVersion = body.communityAcceptedVersion;
      u.version += 1;
      const data = meDto(uid);
      return { data, version: data.version };
    },
    getPublicProfile: ({ params, query }) => {
      const u = w.users.get(params.userId);
      if (!u || !u.displayName) fail('NOT_FOUND', 'This profile is unavailable.');
      const t = now();
      const published = w.reviews
        .filter((r) => r.subjectId === params.userId && reviewVisibility(r, t) === 'PUBLISHED')
        .map((r) => ({ id: r.id, mealId: r.mealId, author: publicProfile(r.authorId), body: r.body, publishedAt: iso(reviewPublishAt(r)) }))
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
      const page = paginate(published, query.cursor, query.limit);
      return { data: { profile: publicProfile(params.userId), reviews: page.data, nextReviewCursor: page.page.nextCursor } };
    },
    searchVenues: ({ query }) => {
      const q = query.q?.trim().toLowerCase();
      const bounds = [query.north, query.south, query.east, query.west];
      const n = bounds.filter((v) => v !== undefined).length;
      if (n !== 0 && n !== 4) fail('VALIDATION_FAILED', 'All map bounds are required.');
      const matches = SEED_VENUES.filter((v) => (!q || `${v.name} ${v.address} ${v.note}`.toLowerCase().includes(q))
        && (n === 0 || (v.lat <= query.north! && v.lat >= query.south! && v.lng <= query.east! && v.lng >= query.west!)));
      const page = paginate(matches.map((v) => ({ placeId: v.placeId, name: v.name, address: v.address, location: { lat: v.lat, lng: v.lng }, photoRefs: [], attributions: [] })), query.cursor, 20);
      return { data: page.data, page: page.page };
    },
    getVenuePhoto: ({ params }) => {
      const v = w.venues.get(params.venueRef) ?? fail('NOT_FOUND', 'This restaurant can no longer be verified.');
      return { data: { placeId: v.placeId, photo: { uri: previewImageUrl('restaurant'), authorAttributions: [{ displayName: 'Fancy preview image', uri: null }], source: 'Google Maps' as const } } };
    },
    confirmVenue: ({ body }) => {
      const v = SEED_VENUES.find((x) => x.placeId === body.placeId) ?? fail('NOT_FOUND', 'This restaurant can no longer be verified. Choose another restaurant.');
      return { data: venueDto(v.venueRef) };
    },

    // ── meals ──
    discoverMeals: ({ query, viewer }) => {
      const q = query;
      const bounds = [q.north, q.south, q.east, q.west];
      const n = bounds.filter((v) => v !== undefined).length;
      if (n !== 0 && n !== 4) fail('VALIDATION_FAILED', 'All map bounds are required.');
      const split = (v: string | undefined) => (v ? v.split(',') : []);
      const keyword = q.keyword?.trim().toLowerCase();
      const meals = [...w.meals.values()]
        .filter((m) => m.status === 'OPEN')
        .sort((a, b) => a.startMs - b.startMs || a.id.localeCompare(b.id))
        .filter((m) => {
          const start = londonTime(m.startMs);
          const hour = Number(start.localTime.slice(0, 2));
          const venue = w.venues.get(m.venueRef);
          if (split(q.dates).length && !split(q.dates).includes(start.localDate)) return false;
          if (q.timeOfDay === 'lunch' && hour >= 16) return false;
          if (q.timeOfDay === 'dinner' && hour < 16) return false;
          if (split(q.areaCodes).length && !split(q.areaCodes).includes(m.areaCode)) return false;
          if (q.budgetMaxPence !== undefined && m.budgetMaxPence > q.budgetMaxPence) return false;
          if (split(q.tableSizes).length && !split(q.tableSizes).includes(String(m.capacity))) return false;
          if (split(q.languages).length && !m.languages.some((l) => split(q.languages).includes(l))) return false;
          if (split(q.moods).length && !split(q.moods).includes(m.mood)) return false;
          if (split(q.cuisineCodes).length && (!m.cuisineCode || !split(q.cuisineCodes).includes(m.cuisineCode))) return false;
          if (split(q.dietaryCodes).length && !m.dietaryCodes?.some((d) => split(q.dietaryCodes).includes(d))) return false;
          if (keyword && ![m.title, m.description, venue?.name ?? ''].some((s) => s.toLowerCase().includes(keyword))) return false;
          if (n === 4 && venue) {
            const north = q.north!, south = q.south!, east = q.east!, west = q.west!;
            if (venue.lat > north || venue.lat < south || (west <= east ? venue.lng < west || venue.lng > east : venue.lng < west && venue.lng > east)) return false;
          }
          return true;
        });
      const page = paginate(meals.map((m) => mealDto(m, viewer)), q.cursor, q.limit);
      return { data: page.data, page: page.page };
    },
    getMeal: ({ params, viewer }) => {
      const meal = mealOr404(params.mealId);
      const mine = viewer ? applicationsOf(meal.id, viewer)[0] : undefined;
      const conv = meal.conversationId ? w.conversations.get(meal.conversationId) : undefined;
      return {
        data: { meal: mealDto(meal, viewer), myApplication: mine ? applicationDto(mine) : null, conversationId: viewer && conv && isMember(conv, viewer) ? conv.id : null },
        version: String(meal.version),
      };
    },
    createMeal: ({ uid, body }) => {
      requireProfile(uid);
      const venue = w.venues.get(body.venueRef) ?? fail('NOT_FOUND', 'Confirm a restaurant first.');
      const { startMs, closeMs } = validateArrangement(body);
      if ([...w.meals.values()].some((m) => m.hostId === uid && m.attemptId === body.attemptId)) fail('STATE_CONFLICT', 'This publishing attempt already created a meal.');
      const t = now();
      const meal: MealRec = {
        id: newId(w, 'meal'), version: 1, hostId: uid, venueRef: venue.venueRef, title: body.title.trim(), description: body.description.trim(), startMs, closeMs,
        endMs: startMs + 2 * HOUR, minimum: body.minimum, capacity: body.capacity, budgetMinPence: body.budgetMinPence, budgetMaxPence: body.budgetMaxPence,
        languages: [...body.languages], mood: body.mood, areaCode: venue.areaCode, cuisineCode: body.cuisineCode ?? null,
        dietaryCodes: normalizeDietary(body.dietaryCodes), status: 'OPEN', cancelReason: null, lockedAt: null, seats: [], seatSeq: 0, declarations: [],
        conversationId: null, attemptId: body.attemptId, marks: { close: false, start: false, end: false }, startRoster: null,
      };
      w.meals.set(meal.id, meal);
      addSeat(meal, uid, 'HOST_CONFIRMED', t);
      const conv = newConversation(w, newId(w, 'conversation'), 'GROUP', meal.id, null, t);
      meal.conversationId = conv.id;
      joinConversation(conv, uid, t);
      meal.declarations.push({ id: newId(w, 'misc'), revision: 1, status: 'REPORTED_CONFIRMED', count: body.capacity, reportedAt: t, key: arrangementKey(meal, body.capacity, meal.seatSeq) });
      // demo host "Requests" card: Emma asks to join the new table.
      if (uid === ALEX && t < closeMs) {
        const app: AppRec = { id: newId(w, 'application'), mealId: meal.id, userId: userId('emma'), round: 1, state: 'PENDING', version: 1, createdAt: t, decidedAt: null, message: EMMA_REQUEST };
        w.applications.set(app.id, app);
        notify(uid, 'application_submitted', { mealId: meal.id, applicationId: app.id }, t);
      }
      return { data: mealDto(meal, uid), version: String(meal.version) };
    },
    editMeal: ({ uid, params, body, ifMatch }) => {
      const meal = mealOr404(params.mealId);
      if (meal.hostId !== uid) fail('FORBIDDEN', 'Only the host can edit this meal.');
      openMeal(meal);
      checkVersion(meal.version, ifMatch);
      if (meal.lockedAt !== null) fail('ARRANGEMENT_LOCKED', 'The arrangement is locked after the first guest is approved.');
      if (now() >= meal.closeMs) fail('DEADLINE_PASSED', 'Applications have closed.');
      const venue = w.venues.get(body.venueRef ?? meal.venueRef) ?? fail('NOT_FOUND', 'Confirm a restaurant first.');
      const start = londonTime(meal.startMs), close = londonTime(meal.closeMs);
      const full = {
        title: body.title ?? meal.title, description: body.description ?? meal.description,
        start: body.start ?? { localDate: start.localDate, localTime: start.localTime, timeZone: 'Europe/London' as const, utcOffsetMinutes: start.utcOffsetMinutes },
        close: body.close ?? { localDate: close.localDate, localTime: close.localTime, timeZone: 'Europe/London' as const, utcOffsetMinutes: close.utcOffsetMinutes },
        minimum: body.minimum ?? meal.minimum, capacity: body.capacity ?? meal.capacity,
        budgetMinPence: body.budgetMinPence ?? meal.budgetMinPence, budgetMaxPence: body.budgetMaxPence ?? meal.budgetMaxPence,
      };
      const { startMs, closeMs } = validateArrangement(full);
      requireProfile(uid);
      Object.assign(meal, {
        venueRef: venue.venueRef, areaCode: venue.areaCode, title: full.title.trim(), description: full.description.trim(), startMs, closeMs, endMs: startMs + 2 * HOUR,
        minimum: full.minimum, capacity: full.capacity, budgetMinPence: full.budgetMinPence, budgetMaxPence: full.budgetMaxPence,
        languages: body.languages ? [...body.languages] : meal.languages, mood: body.mood ?? meal.mood,
        cuisineCode: body.cuisineCode !== undefined ? body.cuisineCode : meal.cuisineCode,
        dietaryCodes: body.dietaryCodes !== undefined ? normalizeDietary(body.dietaryCodes) : meal.dietaryCodes,
      });
      meal.version += 1;
      return { data: mealDto(meal, uid), version: String(meal.version) };
    },
    declareBooking: ({ uid, params, body, ifMatch }) => {
      const meal = mealOr404(params.mealId);
      if (meal.hostId !== uid) fail('FORBIDDEN', 'Only the host can report a booking.');
      openMeal(meal);
      checkVersion(meal.version, ifMatch);
      meal.declarations.push({ id: newId(w, 'misc'), revision: (meal.declarations.at(-1)?.revision ?? 0) + 1, status: body.status, count: body.count, reportedAt: now(), key: arrangementKey(meal, body.count, meal.seatSeq) });
      meal.version += 1;
      return { status: 201, data: mealDto(meal, uid), version: String(meal.version) };
    },
    cancelMeal: ({ uid, params, body, ifMatch }) => {
      const meal = mealOr404(params.mealId);
      if (meal.hostId !== uid) fail('FORBIDDEN', 'Only the host can cancel.');
      openMeal(meal);
      checkVersion(meal.version, ifMatch);
      if (now() >= meal.startMs) fail('DEADLINE_PASSED', 'This meal has already started.');
      cancelState(meal, body.reason, now());
      return { data: mealDto(meal, uid), version: String(meal.version) };
    },
    applyMeal: ({ uid, params, body }) => {
      const message = body.message.trim();
      if ([...message].length < 20 || [...message].length > 300) fail('VALIDATION_FAILED', 'Application messages must contain 20 to 300 characters.');
      const meal = mealOr404(params.mealId);
      openMeal(meal);
      requireProfile(uid);
      if (meal.hostId === uid) fail('FORBIDDEN', 'You already host this meal.');
      const t = now();
      if (t >= meal.closeMs) fail('DEADLINE_PASSED', 'Applications have closed.');
      if (currentSeats(meal, t).length >= meal.capacity) fail('MEAL_FULL', 'This table is full.');
      const previous = applicationsOf(meal.id, uid);
      if (previous.some((a) => a.state === 'DECLINED')) fail('APPLICATION_DECLINED_FINAL', 'You cannot reapply to this meal after being declined.');
      if (previous.some((a) => a.state === 'PENDING' || a.state === 'CONFIRMED')) fail('STATE_CONFLICT', 'You already have an active application.');
      const app: AppRec = { id: newId(w, 'application'), mealId: meal.id, userId: uid, round: (previous[0]?.round ?? 0) + 1, state: 'PENDING', version: 1, createdAt: t, decidedAt: null, message };
      w.applications.set(app.id, app);
      return { data: applicationDto(app), version: String(app.version) };
    },
    listApplications: ({ uid, params, query }) => {
      const meal = mealOr404(params.mealId);
      const items = [...w.applications.values()]
        .filter((a) => a.mealId === meal.id && (meal.hostId === uid || a.userId === uid))
        .sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
      const page = paginate(items.map(applicationDto), query.cursor, query.limit);
      return { data: page.data, page: page.page };
    },
    decideApplication: ({ uid, params, body, ifMatch }) => {
      const app = w.applications.get(params.applicationId) ?? fail('NOT_FOUND', 'Application not found.');
      const meal = mealOr404(app.mealId);
      if (meal.hostId !== uid) fail('FORBIDDEN', 'Only the host can decide this application.');
      openMeal(meal);
      checkVersion(app.version, ifMatch, 'This application has changed. Refresh and try again.');
      const t = now();
      if (t >= meal.closeMs) fail('DEADLINE_PASSED', 'Applications have closed.');
      if (app.state !== 'PENDING') fail('STATE_CONFLICT', 'This application has already been decided.');
      if (body.decision === 'APPROVE') {
        if (currentSeats(meal, t).length >= meal.capacity) fail('MEAL_FULL', 'This table is full.');
        approve(meal, app, t);
      } else {
        app.state = 'DECLINED';
        app.version += 1;
        app.decidedAt = t;
      }
      return { data: { application: applicationDto(app), mealVersion: String(meal.version), conversationId: meal.conversationId }, version: String(app.version) };
    },
    withdrawApplication: ({ uid, params, ifMatch }) => {
      const app = w.applications.get(params.applicationId) ?? fail('NOT_FOUND', 'Application not found.');
      if (app.userId !== uid) fail('FORBIDDEN', 'This application belongs to another member.');
      checkVersion(app.version, ifMatch, 'This application has changed. Refresh and try again.');
      if (app.state !== 'PENDING') fail('STATE_CONFLICT', 'Only pending applications can be withdrawn.');
      app.state = 'WITHDRAWN';
      app.version += 1;
      app.decidedAt = now();
      return { data: applicationDto(app), version: String(app.version) };
    },
    leaveMeal: ({ uid, params, ifMatch }) => {
      const meal = mealOr404(params.mealId);
      openMeal(meal);
      checkVersion(meal.version, ifMatch);
      if (meal.hostId === uid) fail('FORBIDDEN', 'Hosts must cancel their meal instead.');
      const t = now();
      if (t >= meal.startMs) fail('DEADLINE_PASSED', 'You cannot leave after the meal starts.');
      const app = applicationsOf(meal.id, uid).find((a) => a.state === 'CONFIRMED') ?? fail('STATE_CONFLICT', 'You do not hold a confirmed seat.');
      app.state = 'CANCELLED';
      app.version += 1;
      app.decidedAt = t;
      addSeat(meal, uid, 'LEFT', t);
      meal.version += 1;
      if (t >= meal.closeMs && currentSeats(meal, t).length < meal.minimum) cancelState(meal, 'insufficient', t);
      return { data: { application: applicationDto(app), meal: mealDto(meal, uid) }, version: String(meal.version) };
    },
    myMeals: ({ uid, query }) => {
      const t = now();
      const items: Array<{ key: [number, string]; data: DataOf<'myMeals'>[number] }> = [];
      const meals = [...w.meals.values()].filter((m) => m.hostId === uid || [...w.applications.values()].some((a) => a.mealId === m.id && a.userId === uid));
      for (const meal of meals) {
        const apps = [...w.applications.values()].filter((a) => a.mealId === meal.id && a.userId === uid).sort((a, b) => b.createdAt - a.createdAt || b.round - a.round);
        const mine = apps[0];
        const host = meal.hostId === uid;
        const dto = mealDto(meal, uid);
        const roster = t >= meal.startMs ? rosterAt(meal.seats, meal.startMs) : [];
        const visible = query.section === 'HOSTING' ? host
          : query.section === 'UPCOMING' ? dto.status === 'OPEN' && t < meal.endMs && (host || mine?.state === 'CONFIRMED')
            : query.section === 'PAST' ? dto.status !== 'CANCELLED' && t >= meal.endMs && roster.includes(uid)
              : query.section === 'CANCELLED' ? dto.status === 'CANCELLED' || mine?.state === 'CANCELLED'
                : apps.length > 0;
        if (!visible) continue;
        const rows: Array<AppRec | null> = query.section === 'APPLICATIONS' ? apps : [mine ?? null];
        for (const row of rows) {
          items.push({
            key: query.section === 'APPLICATIONS' ? [row!.createdAt, row!.id] : [meal.startMs, meal.id],
            data: { meal: dto, application: row ? applicationDto(row) : null, role: host ? 'HOST' : row?.state === 'CONFIRMED' ? 'GUEST' : 'APPLICANT' },
          });
        }
      }
      const descending = query.section === 'APPLICATIONS' ? -1 : 1;
      items.sort((a, b) => ((a.key[0] - b.key[0]) || a.key[1].localeCompare(b.key[1])) * descending);
      const page = paginate(items.map((i) => i.data), query.cursor, query.limit);
      return { data: page.data, page: page.page };
    },

    // ── conversations ──
    markConversationRead: ({ uid, params, body }) => {
      const conv = convFor(params.conversationId, uid);
      const through = Number(body.throughSeq);
      if (through > conv.head) fail('VALIDATION_FAILED', 'That message position is not available.');
      conv.reads.set(uid, Math.max(conv.reads.get(uid) ?? 0, through));
      return { status: 204, data: undefined };
    },
    inbox: ({ uid, query }) => {
      const entries: Array<{ at: number; id: string; data: DataOf<'inbox'>[number] }> = [];
      for (const conv of w.conversations.values()) {
        if (!isMember(conv, uid)) continue;
        const visible = conv.messages.filter((m) => visibleTo(conv, uid, m.seq));
        const last = visible.at(-1);
        const read = conv.reads.get(uid) ?? 0;
        entries.push({
          at: conv.createdAt, id: conv.id,
          data: {
            conversation: convDto(conv, uid), lastMessage: last ? { seq: String(last.seq), preview: last.body.slice(0, 200), createdAt: iso(last.createdAt) } : null,
            unreadCount: visible.filter((m) => m.senderId !== uid && m.seq > read).length,
          },
        });
      }
      for (const app of w.applications.values()) {
        if (app.userId !== uid) continue;
        const meal = w.meals.get(app.mealId);
        if (!meal) continue;
        const conv = meal.conversationId ? w.conversations.get(meal.conversationId) : undefined;
        if (conv && isMember(conv, uid)) continue;
        entries.push({
          at: app.createdAt, id: app.id,
          data: {
            application: applicationDto(app),
            applicationMeal: { title: meal.title, startsAt: londonTime(meal.startMs), hostDisplayName: w.users.get(meal.hostId)?.displayName ?? 'Fancy member' },
            lastMessage: null, unreadCount: 0,
          },
        });
      }
      entries.sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
      const page = paginate(entries.map((e) => e.data), query.cursor, query.limit);
      return { data: page.data, page: page.page };
    },
    readMessages: ({ uid, params, query }) => {
      const conv = convFor(params.conversationId, uid);
      if (query.mode === 'LIVE') liveConv(conv, uid);
      const limit = query.limit ?? 20;
      let key: number;
      if (query.cursor !== undefined) {
        const m = /^s(\d{1,19})$/.exec(query.cursor);
        if (!m) fail('VALIDATION_FAILED', 'Invalid message position.');
        key = Number(m![1]);
      } else key = query.mode === 'LIVE' ? Number(query.afterSeq ?? '0') : conv.head + 1;
      const visible = conv.messages.filter((m) => visibleTo(conv, uid, m.seq) && m.seq <= conv.head);
      const rows = query.mode === 'LIVE'
        ? visible.filter((m) => m.seq > key).sort((a, b) => a.seq - b.seq)
        : visible.filter((m) => m.seq < key).sort((a, b) => b.seq - a.seq);
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      const last = page.at(-1)?.seq ?? key;
      return {
        data: page.map(messageDto),
        page: { hasMore, nextCursor: hasMore ? `s${last}` : null, scannedThroughSeq: String(query.mode === 'LIVE' && hasMore ? last : conv.head) },
      };
    },
    sendMessage: ({ uid, params, body }) => {
      const text = body.body.trim();
      if (!text || text.length > 2000) fail('VALIDATION_FAILED', 'Use 1–2000 characters.');
      const conv = convFor(params.conversationId, uid);
      liveConv(conv, uid);
      for (const c of w.conversations.values()) {
        const duplicate = c.messages.find((m) => m.senderId === uid && m.clientMessageId === body.clientMessageId);
        if (duplicate) {
          if (duplicate.body !== text || c.id !== conv.id) fail('IDEMPOTENCY_CONFLICT', 'This message id was already used.');
          return { data: messageDto(duplicate) };
        }
      }
      return { data: messageDto(postMessage(conv, uid, text, now(), body.clientMessageId, w)) };
    },
    leaveGroup: ({ uid, params, ifMatch }) => {
      const conv = convFor(params.conversationId, uid);
      if (conv.kind !== 'GROUP') fail('FORBIDDEN', 'This is not a group.');
      checkVersion(conv.version, ifMatch, 'This conversation changed.');
      const open = openInterval(conv, uid);
      if (open && conv.dissolvedAt === null) open.leave = allocate(conv, 'LEAVE');
      return { data: convDto(conv, uid, false), version: String(conv.version) };
    },
    dissolveGroup: ({ uid, params, ifMatch }) => {
      const conv = convFor(params.conversationId, uid);
      if (conv.kind !== 'GROUP') fail('FORBIDDEN', 'This is not a group.');
      checkVersion(conv.version, ifMatch, 'This conversation changed.');
      if (w.meals.get(conv.mealId ?? '')?.hostId !== uid) fail('FORBIDDEN', 'Only the host can dissolve the group.');
      if (conv.dissolvedAt === null) {
        const seq = allocate(conv, 'DISSOLVE');
        for (const i of conv.intervals) if (i.leave === null) i.leave = seq;
        conv.dissolvedAt = now();
      }
      return { data: convDto(conv, uid, false), version: String(conv.version) };
    },

    // ── post-meal ──
    postMealState: ({ uid, params }) => {
      const meal = mealOr404(params.mealId);
      const t = now();
      const members = t >= meal.startMs ? (meal.startRoster ?? rosterAt(meal.seats, meal.startMs)) : [];
      if (meal.status === 'CANCELLED' || !members.includes(uid)) fail('FORBIDDEN', 'Only the meal start roster can use this page.');
      const experience = w.experiences.get(`${meal.id}:${uid}`);
      const latestReviews = new Map<string, ReviewRec>();
      for (const r of w.reviews) if (r.mealId === meal.id && r.authorId === uid && (latestReviews.get(r.subjectId)?.revision ?? 0) < r.revision) latestReviews.set(r.subjectId, r);
      return {
        data: {
          mealId: meal.id, windowOpensAt: iso(meal.endMs), windowClosesAt: iso(meal.endMs + POST_MEAL_WINDOW_MS), windowOpen: t >= meal.endMs && t < meal.endMs + POST_MEAL_WINDOW_MS,
          eligibleMembers: members.map(publicProfile), attendance: members.map((id) => attendanceState(meal.id, id)),
          experience: experience ? { score: experience.score, version: String(experience.revision) } : null,
          reviews: [...latestReviews.values()].map((r) => ({ subjectId: r.subjectId, version: String(r.revision), visibility: reviewVisibility(r, t) })),
          reconnect: members.filter((id) => id !== uid).map((id) => connectionState(pairOf(w, uid, id), uid, id)),
        },
      };
    },
    reportAttendance: ({ uid, params, body, ifMatch }) => {
      const meal = mealOr404(params.mealId);
      assertRoster(meal, [params.subjectId]);
      assertWindow(meal);
      const source = uid === params.subjectId ? 'SELF' : 'HOST';
      if (source === 'HOST' && uid !== meal.hostId) fail('FORBIDDEN', 'You cannot report attendance for this member.');
      const before = attendanceState(meal.id, params.subjectId);
      checkVersion(Number(before.version), ifMatch, 'Attendance has changed.');
      const key = `${meal.id}:${params.subjectId}`;
      w.attendance.set(key, [...(w.attendance.get(key) ?? []), { source, value: body.value, version: Number(before.version) + 1 }]);
      // Attendance can withdraw a direct-message basis (apps/api invalidateIneligiblePairs).
      for (const pair of w.pairs.values()) if (pair.users.includes(params.subjectId) && !validSharedMeals(pair).length) clearConsents(pair);
      const data = attendanceState(meal.id, params.subjectId);
      return { data, version: data.version };
    },
    rateExperience: ({ uid, params, body, ifMatch }) => {
      const meal = mealOr404(params.mealId);
      assertWindow(meal);
      if (!isPresent(meal.id, uid)) fail('FORBIDDEN', 'Attendance is required to rate this meal.');
      const key = `${meal.id}:${uid}`;
      const revision = w.experiences.get(key)?.revision ?? 0;
      checkVersion(revision, ifMatch, 'Your rating has changed.');
      w.experiences.set(key, { score: body.score, revision: revision + 1 });
      return { data: { version: String(revision + 1), updatedAt: iso(now()) }, version: String(revision + 1) };
    },
    reviewPerson: ({ uid, params, body, ifMatch }) => {
      const text = body.body.trim();
      if (!text || [...text].length > 500) fail('VALIDATION_FAILED', 'References must contain 1 to 500 characters.');
      const meal = mealOr404(params.mealId);
      assertWindow(meal);
      if (uid === params.subjectId || !isPresent(meal.id, uid) || !isPresent(meal.id, params.subjectId)) fail('FORBIDDEN', 'Both members must have attended this meal.');
      const revision = w.reviews.filter((r) => r.mealId === meal.id && r.authorId === uid && r.subjectId === params.subjectId).reduce((max, r) => Math.max(max, r.revision), 0);
      checkVersion(revision, ifMatch, 'Your reference has changed.');
      const review: ReviewRec = { id: newId(w, 'misc'), mealId: meal.id, authorId: uid, subjectId: params.subjectId, body: text, revision: revision + 1, createdAt: now() };
      w.reviews.push(review);
      return { data: { subjectId: params.subjectId, version: String(review.revision), publishAt: iso(reviewPublishAt(review)), visibility: reviewVisibility(review, now()) }, version: String(review.revision) };
    },
    selectReconnect: ({ uid, params, body, ifMatch }) => {
      const pair = otherMember(uid, params.subjectId);
      const meal = mealOr404(params.mealId);
      assertWindow(meal);
      assertRoster(meal, [uid, params.subjectId]);
      const before = connectionState(pair, uid, params.subjectId);
      checkVersion(Number(before.version), ifMatch, 'Your connection choice has changed.');
      if (!body.selected) {
        clearConsents(pair);
        const data = connectionState(pair, uid, params.subjectId);
        return { data, version: data.version };
      }
      if (w.blocks.get(`${pair.users[0]}:${pair.users[1]}`)?.active || w.blocks.get(`${pair.users[1]}:${pair.users[0]}`)?.active) fail('FORBIDDEN', 'This connection is unavailable.');
      if (!validSharedMeals(pair).includes(meal.id)) fail('FORBIDDEN', 'Both members must have attended this meal.');
      pair.consents.set(uid, { revision: Number(before.version) + 1, active: true });
      const data = connectionState(pair, uid, params.subjectId);
      if (data.connection === 'OPEN') ensureDirect(pair, params.subjectId);
      return { data, version: data.version };
    },
    revokeConnection: ({ uid, params, ifMatch }) => {
      const pair = otherMember(uid, params.subjectId);
      const before = connectionState(pair, uid, params.subjectId);
      checkVersion(Number(before.version), ifMatch, 'Your connection changed.');
      clearConsents(pair);
      const data = connectionState(pair, uid, params.subjectId);
      return { data, version: data.version };
    },
    getBlock: ({ uid, params }) => {
      if (params.subjectId === uid) fail('FORBIDDEN', 'Choose another member.');
      if (!w.users.has(params.subjectId)) fail('NOT_FOUND', 'This member is unavailable.');
      const b = w.blocks.get(`${uid}:${params.subjectId}`);
      const data = { subjectId: params.subjectId, blocked: !!b?.active, version: String(b?.version ?? 0) };
      return { data, version: data.version };
    },
    block: ({ uid, params, ifMatch }) => setBlock(uid, params.subjectId, true, ifMatch),
    unblock: ({ uid, params, ifMatch }) => setBlock(uid, params.subjectId, false, ifMatch),
    getDirect: ({ uid, params }) => {
      const pair = w.pairs.get(pairKey(uid, params.subjectId));
      const conv = pair ? [...w.conversations.values()].find((c) => c.kind === 'DIRECT' && c.pair && pairKey(c.pair[0], c.pair[1]) === pairKey(uid, params.subjectId) && isMember(c, uid)) : undefined;
      if (!pair || !conv) return fail('NOT_FOUND', 'Conversation not found.');
      const data: ConversationDto = { id: conv.id, version: String(conv.version), kind: 'DIRECT', mealId: null, title: publicProfile(params.subjectId).displayName, canSend: directAuthorized(pair), dissolved: false, head: String(conv.head) };
      return { data, version: data.version };
    },
    getSurvey: () => ({ data: surveyDto(), version: String(w.survey.version) }),
    putSurvey: ({ body, ifMatch }) => {
      checkVersion(w.survey.version, ifMatch, 'Your answers changed.');
      w.survey = { version: w.survey.version + 1, again: body.again, reasons: [...body.reasons], submittedAt: now() };
      return { data: surveyDto(), version: String(w.survey.version) };
    },

    // ── account support used by the app (operations-admin.ts, user-facing subset) ──
    listNotifications: ({ uid, query }) => {
      const items = w.notifications.filter((n) => n.userId === uid).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).map(notificationDto);
      const page = paginate(items, query.cursor, query.limit);
      return { data: page.data, page: page.page };
    },
    markRead: ({ uid, params }) => {
      const n = w.notifications.find((x) => x.id === params.notificationId && x.userId === uid) ?? fail('NOT_FOUND', 'Notification not found.');
      n.readAt ??= now();
      return { data: notificationDto(n) };
    },
    createReport: ({ uid, body }) => {
      const exists = body.targetType === 'USER' ? w.users.has(body.targetId)
        : body.targetType === 'MEAL' ? w.meals.has(body.targetId)
          : [...w.conversations.values()].some((c) => c.messages.some((m) => m.id === body.targetId && visibleTo(c, uid, m.seq)));
      if (!exists) fail('NOT_FOUND', 'We could not find what you are reporting.');
      const report: ReportRec = { id: newId(w, 'misc'), userId: uid, receipt: `FCY-${String(w.counter).padStart(6, '0')}`, targetType: body.targetType, createdAt: now() };
      w.reports.set(report.id, report);
      return { data: reportDto(report), version: '1' };
    },
    reportStatus: ({ uid, params }) => {
      const report = w.reports.get(params.reportId);
      if (!report || report.userId !== uid) return fail('NOT_FOUND', 'Report not found.');
      return { data: reportDto(report) };
    },
    requestDeletion: ({ uid, body, ifMatch }) => {
      checkVersion(user(uid).version, ifMatch, 'Your profile changed. Reload it before deleting.');
      const requestedAt = now();
      deletions.set(body.receiptToken, { requestedAt });
      deleted = true;
      return { data: { status: 'COMPLETED', requestedAt: iso(requestedAt), completedAt: iso(requestedAt) } };
    },
    deletionStatus: ({ body }) => {
      const d = deletions.get(body.receiptToken) ?? fail('NOT_FOUND', 'No deletion request matches this receipt.');
      return { data: { status: 'COMPLETED', requestedAt: iso(d.requestedAt), completedAt: iso(d.requestedAt) } };
    },
    ingestEvents: ({ body }) => {
      const scope = body.consent.analytics ? { 'x-fancy-analytics-scope': `${'p'.repeat(43)}.${'v'.repeat(43)}` } : undefined;
      return { data: { results: body.events.map((e) => ({ eventId: e.eventId, status: 'accepted' as const })) }, ...(scope ? { headers: scope } : {}) };
    },
  };

  function ensureDirect(pair: PairRec, peer: string) {
    const existing = [...w.conversations.values()].find((c) => c.kind === 'DIRECT' && c.pair && pairKey(c.pair[0], c.pair[1]) === pairKey(pair.users[0], pair.users[1]));
    if (existing) return existing;
    const t = now();
    const conv = newConversation(w, newId(w, 'conversation'), 'DIRECT', null, pair.users, t);
    for (const id of pair.users) joinConversation(conv, id, t);
    if (peer !== ALEX) postMessage(conv, peer, DIRECT_OPENER, t + 1_000, null, w);
    return conv;
  }
  function setBlock(uid: string, subjectId: string, blocked: boolean, ifMatch: string | null): { data: DataOf<'block'> & DataOf<'unblock'>; version: string } {
    const pair = otherMember(uid, subjectId);
    const key = `${uid}:${subjectId}`;
    const version = w.blocks.get(key)?.version ?? 0;
    checkVersion(version, ifMatch, 'Your block setting changed.');
    if (blocked) clearConsents(pair);
    w.blocks.set(key, { active: blocked, version: version + 1 });
    const data = { subjectId, blocked, version: String(version + 1) };
    return { data, version: data.version };
  }
  const surveyDto = (): DataOf<'getSurvey'> => ({ version: String(w.survey.version), again: w.survey.again, reasons: [...w.survey.reasons], submittedAt: w.survey.submittedAt === null ? null : iso(w.survey.submittedAt) });
  const notificationDto = (n: NotificationRec): DataOf<'markRead'> => ({ id: n.id, template: n.template, createdAt: iso(n.createdAt), readAt: n.readAt === null ? null : iso(n.readAt), mealId: n.mealId, applicationId: n.applicationId, conversationId: n.conversationId });
  const reportDto = (r: ReportRec): DataOf<'createReport'> => ({ id: r.id, receipt: r.receipt, status: 'RECEIVED', targetType: r.targetType, publicOutcome: null, createdAt: iso(r.createdAt) });

  // ── transport ──
  const routes = Object.values(operationsById).map((def) => ({
    def,
    method: def.method,
    names: [...def.path.matchAll(/\{([A-Za-z]+)\}/g)].map((m) => m[1]!),
    regex: new RegExp(`^/v1${def.path.replace(/\{[A-Za-z]+\}/g, '([^/]+)')}$`),
  }));

  function envelopeError(code: ErrorCode, message: string, extra: Record<string, unknown> = {}) {
    return { status: ERROR_STATUS[code], body: { error: { code, message, ...extra }, meta: meta() } };
  }
  function meta(version?: string) {
    requestCounter += 1;
    return { requestId: `preview-${requestCounter}`, serverNow: iso(now()), ...(version !== undefined ? { version } : {}) };
  }
  function viewerFrom(headers: Record<string, string>): string | null {
    const bearer = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(headers.authorization ?? '')?.[1];
    return bearer && bearer.startsWith('pv_access_') && !revoked.has(bearer) && !deleted ? ALEX : null;
  }

  function handle(method: string, url: ParsedUrl, headers: Record<string, string>, rawBody: string | undefined): { status: number; body?: unknown; headers?: Record<string, string> } {
    const route = routes.find((r) => r.method === method && r.regex.test(url.pathname));
    if (!route) return envelopeError('NOT_FOUND', 'Not found.');
    const def: OperationDef = route.def;
    const id = def.operationId as OperationId;
    if (def.path.startsWith('/ai/') || id === 'createGuestSession') return envelopeError('AI_UNAVAILABLE', 'The assistant is not available in preview.');
    const handler = handlers[id] as ((ctx: Ctx<OperationId>) => Out<OperationId>) | undefined;
    if (!handler) return envelopeError('NOT_FOUND', 'Not found.');

    let body: unknown;
    if (def.body) {
      try {
        body = rawBody === undefined || rawBody === '' ? undefined : JSON.parse(rawBody);
      } catch {
        return envelopeError('INVALID_REQUEST', 'The request could not be read.');
      }
      if (body === undefined) return envelopeError('INVALID_REQUEST', 'The request could not be read.');
    }
    const match = route.regex.exec(url.pathname)!;
    const rawParams: Record<string, string> = {};
    route.names.forEach((name, i) => (rawParams[name] = decodeURIComponent(match[i + 1]!)));
    const rawQuery: Record<string, string> = {};
    for (const [k, v] of url.query) rawQuery[k] = v;
    const params = coerceStrings(def.params as Record<string, unknown> | undefined, rawParams);
    const query = coerceStrings(def.query as Record<string, unknown> | undefined, rawQuery);
    const fieldErrors: Record<string, string> = {};
    if (def.params) validate(def.params as unknown as Record<string, unknown>, params, 'params', fieldErrors);
    if (def.query) validate(def.query as unknown as Record<string, unknown>, query, 'querystring', fieldErrors);
    else if (Object.keys(query).length) Object.keys(query).forEach((k) => (fieldErrors[`querystring.${k}`] = 'Unknown field'));
    if (def.body) validate(def.body as unknown as Record<string, unknown>, body, 'body', fieldErrors);
    if (Object.keys(fieldErrors).length) return envelopeError('VALIDATION_FAILED', 'Some fields need attention.', { fieldErrors });

    const viewer = def.auth === 'public' || def.auth === 'receipt' ? null : viewerFrom(headers);
    if ((def.auth === 'session' || def.auth === 'staff') && !viewer) return envelopeError('AUTH_REQUIRED', 'Please sign in to continue.');
    let ifMatch: string | null = null;
    if (def.ifMatch) {
      const raw = headers['if-match'];
      if (raw === undefined) return envelopeError('PRECONDITION_REQUIRED', 'This change needs the version you are editing.');
      const m = /^"(0|[1-9][0-9]{0,18})"$/.exec(raw);
      if (!m) return envelopeError('VALIDATION_FAILED', 'If-Match must be a quoted version.', { fieldErrors: { 'headers.if-match': 'Invalid version' } });
      ifMatch = m[1]!;
    }
    let intent: string | null = null;
    if (def.write === 'idempotencyKey') {
      const key = headers['idempotency-key'];
      if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return envelopeError('INVALID_REQUEST', 'Idempotency-Key header (UUID) is required.');
      intent = `${viewer}:${id}:${key.toLowerCase()}`;
      const hash = JSON.stringify([url.pathname, ifMatch, body ?? null]);
      const stored = w.idempotency.get(intent);
      if (stored) {
        if (stored.hash !== hash) return envelopeError('IDEMPOTENCY_CONFLICT', 'This request key was already used for a different request.');
        return { status: stored.status, body: stored.body, headers: { 'idempotent-replay': 'true' } };
      }
    }

    tick();
    let result: { status: number; body?: unknown; headers?: Record<string, string> };
    try {
      const out = handler({ params, query, body, uid: viewer ?? '', viewer, ifMatch, headers } as unknown as Ctx<OperationId>);
      const status = out.status ?? def.success.status;
      const page = out.page;
      result = status === 204 ? { status } : { status, body: page ? { data: out.data, page, meta: meta(out.version) } : { data: out.data, meta: meta(out.version) }, ...(out.headers ? { headers: out.headers } : {}) };
    } catch (error) {
      if (!(error instanceof PreviewError)) throw error;
      result = envelopeError(error.code, error.message, error.extra);
    }
    if (intent && result.status < 500) w.idempotency.set(intent, { hash: JSON.stringify([url.pathname, ifMatch, body ?? null]), status: result.status, body: result.body });
    return result;
  }

  const previewFetch = async (input: string | URL | Request, init: RequestInit = {}): Promise<Response> => {
    const isRequest = typeof input === 'object' && input !== null && typeof (input as Request).url === 'string' && typeof (input as Request).method === 'string';
    const url = parseUrl(isRequest ? (input as Request).url : String(input));
    const method = (init.method ?? (isRequest ? (input as Request).method : 'GET')).toUpperCase();
    const headers = normalizeHeaders(init.headers ?? (isRequest ? (input as Request).headers : undefined));
    const rawBody = typeof init.body === 'string' ? init.body : undefined;
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    let reply: { status: number; body?: unknown; headers?: Record<string, string> };
    try {
      reply = handle(method, url, headers, rawBody);
    } catch {
      reply = envelopeError('INTERNAL_ERROR', 'Something went wrong. Please try again.');
    }
    return makeResponse(reply.status, reply.body, reply.headers ?? {});
  };

  return {
    fetch: previewFetch as typeof fetch,
    now,
    reset() {
      w = seedWorld(now());
      deleted = false;
    },
  };
}

interface ParsedUrl { pathname: string; query: Array<[string, string]> }
/** Manual parse: React Native's URL polyfill does not implement every getter (pathname/searchParams). */
function parseUrl(raw: string): ParsedUrl {
  const m = /^(?:[a-z][a-z0-9+.-]*:\/\/[^/?#]*)?([^?#]*)(?:\?([^#]*))?/i.exec(raw);
  const decode = (v: string) => {
    try {
      return decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      return v;
    }
  };
  const query = (m?.[2] ?? '').split('&').filter(Boolean).map((pair): [string, string] => {
    const i = pair.indexOf('=');
    return i < 0 ? [decode(pair), ''] : [decode(pair.slice(0, i)), decode(pair.slice(i + 1))];
  });
  return { pathname: m?.[1] || '/', query };
}

function normalizeDietary(codes: MealDto['dietaryCodes'] | undefined): MealDto['dietaryCodes'] {
  const order = ['VEGETARIAN_OPTIONS', 'VEGAN'] as const;
  const kept = codes ? order.filter((c) => codes.includes(c)) : [];
  return kept.length ? kept : null;
}

function normalizeHeaders(raw: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw) return out;
  if (Array.isArray(raw)) for (const [k, v] of raw) out[String(k).toLowerCase()] = String(v);
  else if (typeof (raw as Headers).forEach === 'function' && typeof (raw as Headers).get === 'function') (raw as Headers).forEach((v, k) => (out[k.toLowerCase()] = v));
  else for (const [k, v] of Object.entries(raw as Record<string, string>)) out[k.toLowerCase()] = String(v);
  return out;
}

/** Fetch-compatible response (a real Response when the runtime has one). */
function makeResponse(status: number, body: unknown, extra: Record<string, string>): Response {
  const headers: Record<string, string> = { ...(body === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }) };
  for (const [k, v] of Object.entries(extra)) headers[k.toLowerCase()] = v;
  const text = body === undefined ? null : JSON.stringify(body);
  if (typeof Response === 'function') {
    try {
      return new Response(text, { status, headers });
    } catch {
      // Fall through to the minimal shape below (e.g. polyfills that reject some statuses).
    }
  }
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: '',
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null, has: (name: string) => name.toLowerCase() in headers, forEach: (cb: (v: string, k: string) => void) => Object.entries(headers).forEach(([k, v]) => cb(v, k)) },
    json: async () => {
      if (text === null) throw new SyntaxError('Unexpected end of JSON input');
      return JSON.parse(text) as unknown;
    },
    text: async () => text ?? '',
  } as unknown as Response;
}
