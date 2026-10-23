/** Response DTOs (API contract §1). Public projections are explicit allowlists. */
import { DecimalString, Enum, Instant, LocalDate, Obj, Pence, T, Text, UniqueArray, Uuid } from './schema.ts';
import { ZonedTime } from './common.ts';
import {
  ADMIN_PAGES, APPLICATION_STATES, ATTENDANCE_SOURCES, ATTENDANCE_VALUES, AUTH_PROVIDERS, BOOKING_DECLARATION_STATUSES,
  BOOKING_MODES, CANCEL_REASONS, CLASSIFICATIONS, CONNECTION_STATES, CONVERSATION_KINDS, CUISINES, DELETION_STATUSES,
  DIETARY, INTERESTS, LANGUAGE_CODES, LIFE_STATUSES, MEAL_ACTIONS, MEAL_STATUSES, MOODS, REPORT_STATUSES,
  REPORT_TARGET_TYPES, ROLES, SUPPORT_CASE_STATUSES, SURVEY_REASONS,
} from './dictionaries.ts';

const keys = <O extends object>(o: O) => Object.keys(o) as Array<keyof O & string>;

export const LanguageCode = Enum(LANGUAGE_CODES);
export const MoodCode = Enum(keys(MOODS));
export const CuisineCode = Enum(keys(CUISINES));
export const DietaryCode = Enum(keys(DIETARY));
export const LifeStatusCode = Enum(keys(LIFE_STATUSES));
export const InterestCode = Enum(keys(INTERESTS));
/** Versioned London area dictionary code (G-PLACES); `unknown` when no polygon matched. */
export const AreaCode = T.String({ pattern: '^[a-z0-9]+(-[a-z0-9]+)*$', maxLength: 64 });
/** Approved avatar asset reference (no upload flow in MVP). */
export const AvatarRef = T.String({ pattern: '^avatar:[a-z0-9-]{1,40}$' });

export const Background = Obj({
  work: T.Optional(Text(1, 150)),
  school: T.Optional(Text(1, 150)),
  hometown: T.Optional(Text(1, 150)),
});

export const PublicProfile = Obj({
  id: Uuid,
  displayName: Text(2, 40),
  avatarUrl: T.Union([T.String({ format: 'uri', maxLength: 500 }), T.Null()]),
  bio: T.Union([Text(20, 1000), T.Null()]),
  interests: UniqueArray(InterestCode, 0, 11),
  languages: UniqueArray(LanguageCode, 0, 5),
  background: T.Optional(Background),
});

export const ProfileGate = Obj({
  ageConfirmed: T.Boolean(),
  communityAccepted: T.Boolean(),
  profileComplete: T.Boolean(),
  missing: UniqueArray(Enum(['displayName', 'bio', 'languages', 'lifeStatus', 'interests', 'age', 'community'] as const), 0, 7),
});

export const Me = Obj({
  id: Uuid,
  version: DecimalString,
  displayName: T.Union([Text(2, 40), T.Null()]),
  avatarRef: T.Union([AvatarRef, T.Null()]),
  bio: T.Union([Text(20, 1000), T.Null()]),
  languages: UniqueArray(LanguageCode, 0, 5),
  lifeStatus: T.Union([LifeStatusCode, T.Null()]),
  interests: UniqueArray(InterestCode, 0, 11),
  background: Background,
  email: T.Union([T.String({ format: 'email', maxLength: 320 }), T.Null()]),
  ageConfirmedVersion: T.Union([T.String({ maxLength: 40 }), T.Null()]),
  communityAcceptedVersion: T.Union([T.String({ maxLength: 40 }), T.Null()]),
  profileGate: ProfileGate,
  roles: UniqueArray(Enum(ROLES), 0, 3),
});

export const PublicReview = Obj({
  id: Uuid,
  mealId: Uuid,
  author: PublicProfile,
  body: Text(1, 500),
  publishedAt: Instant,
});

export const Attribution = Obj({
  provider: T.Literal('google'),
  html: T.Optional(T.String({ maxLength: 2000 })),
  text: T.String({ maxLength: 500 }),
});

/** Ephemeral provider display only; never persist photo names, URIs or authors. */
export const VenuePhoto = Obj({
  placeId: T.String({minLength:1,maxLength:512}),
  photo: T.Union([Obj({
    uri:T.String({minLength:1,maxLength:4096}),
    authorAttributions:T.Array(Obj({displayName:T.String({minLength:1,maxLength:300}),uri:T.Union([T.String({maxLength:2000}),T.Null()])}),{maxItems:10}),
    source:T.Literal('Google Maps'),
  }),T.Null()]),
});

export const VenueCandidate = Obj({
  placeId: T.String({ minLength: 1, maxLength: 512 }),
  name: T.String({ minLength: 1, maxLength: 300 }),
  address: T.String({ maxLength: 500 }),
  location: T.Optional(Obj({ lat: T.Number({ minimum: -90, maximum: 90 }), lng: T.Number({ minimum: -180, maximum: 180 }) })),
  photoRefs: T.Array(T.String({ maxLength: 1000 }), { maxItems: 10 }),
  attributions: T.Array(Attribution, { maxItems: 10 }),
});

/** Provider display data under the G-PLACES field licence; `available:false` when not verifiable. */
export const Venue = Obj({
  venueRef: Uuid,
  placeId: T.String({ minLength: 1, maxLength: 512 }),
  available: T.Boolean(),
  name: T.Union([T.String({ maxLength: 300 }), T.Null()]),
  address: T.Union([T.String({ maxLength: 500 }), T.Null()]),
  location: T.Union([Obj({ lat: T.Number(), lng: T.Number() }), T.Null()]),
  areaCode: AreaCode,
  attributions: T.Array(Attribution, { maxItems: 10 }),
  displayExpiresAt: T.Union([Instant, T.Null()]),
});

export const BookingDeclaration = Obj({
  id: Uuid,
  revision: DecimalString,
  status: Enum(BOOKING_DECLARATION_STATUSES),
  declaredCount: T.Integer({ minimum: 1, maximum: 6 }),
  reportedAt: Instant,
  stale: T.Boolean(),
});

export const Meal = Obj({
  id: Uuid,
  version: DecimalString,
  host: PublicProfile,
  venue: Venue,
  title: Text(5, 80),
  description: Text(20, 1000),
  startsAt: ZonedTime,
  closesAt: ZonedTime,
  scheduledEndAt: Instant,
  minimum: T.Integer({ minimum: 2, maximum: 6 }),
  capacity: T.Integer({ minimum: 2, maximum: 6 }),
  confirmedCount: T.Integer({ minimum: 0, maximum: 6 }),
  budgetMinPence: Pence,
  budgetMaxPence: Pence,
  currency: T.Literal('GBP'),
  languages: UniqueArray(LanguageCode, 1, 5),
  mood: MoodCode,
  areaCode: AreaCode,
  cuisineCode: T.Union([CuisineCode, T.Null()]),
  dietaryCodes: T.Union([UniqueArray(DietaryCode, 1, 2), T.Null()]),
  declarationSource: T.Literal('host_reported'),
  bookingMode: Enum(BOOKING_MODES),
  status: Enum(MEAL_STATUSES),
  cancelReason: T.Union([Enum(CANCEL_REASONS), T.Null()]),
  arrangementLocked: T.Boolean(),
  bookingDeclaration: T.Union([BookingDeclaration, T.Null()]),
  allowedActions: UniqueArray(Enum(MEAL_ACTIONS), 0, MEAL_ACTIONS.length),
});

export const Application = Obj({
  id: Uuid,
  mealId: Uuid,
  version: DecimalString,
  round: T.Integer({ minimum: 1 }),
  state: Enum(APPLICATION_STATES),
  createdAt: Instant,
  decidedAt: T.Optional(Instant),
  applicant: T.Optional(PublicProfile),
  message: T.Optional(Text(20, 300)),
});

export const MyMealItem = Obj({
  meal: Meal,
  application: T.Union([Application, T.Null()]),
  role: Enum(['HOST', 'GUEST', 'APPLICANT'] as const),
});

export const Message = Obj({
  id: Uuid,
  seq: DecimalString,
  sender: PublicProfile,
  body: T.String({ minLength: 1, maxLength: 2000 }),
  createdAt: Instant,
  redacted: T.Boolean(),
});

export const Conversation = Obj({
  id: Uuid,
  version: DecimalString,
  kind: Enum(CONVERSATION_KINDS),
  mealId: T.Union([Uuid, T.Null()]),
  title: T.String({ maxLength: 120 }),
  canSend: T.Boolean(),
  dissolved: T.Boolean(),
  head: DecimalString,
});

export const InboxItem = Obj({
  applicationMeal: T.Optional(Obj({ title: T.String({ maxLength: 80 }), startsAt: ZonedTime, hostDisplayName: T.String({ maxLength: 40 }) })),
  conversation: T.Optional(Conversation),
  lastMessage: T.Union([Obj({ seq: DecimalString, preview: T.String({ maxLength: 200 }), createdAt: Instant }), T.Null()]),
  unreadCount: T.Integer({ minimum: 0 }),
  application: T.Optional(Application),
});

export const AttendanceState = Obj({
  subjectId: Uuid,
  value: Enum(['present', 'absent', 'unknown'] as const),
  source: T.Union([Enum(ATTENDANCE_SOURCES), T.Null()]),
  selfValue: T.Union([Enum(ATTENDANCE_VALUES), T.Null()]),
  hostValue: T.Union([Enum(ATTENDANCE_VALUES), T.Null()]),
  version: DecimalString,
});

export const PostMealState = Obj({
  mealId: Uuid,
  windowOpensAt: Instant,
  windowClosesAt: Instant,
  windowOpen: T.Boolean(),
  eligibleMembers: T.Array(PublicProfile, { maxItems: 6 }),
  attendance: T.Array(AttendanceState, { maxItems: 6 }),
  experience: T.Union([Obj({ score: T.Integer({ minimum: 1, maximum: 5 }), version: DecimalString }), T.Null()]),
  reviews: T.Array(Obj({ subjectId: Uuid, version: DecimalString, visibility: Enum(['PENDING', 'PUBLISHED', 'WITHDRAWN'] as const) }), { maxItems: 5 }),
  reconnect: T.Array(Obj({ subjectId: Uuid, selected: T.Boolean(), version: DecimalString, connection: Enum(CONNECTION_STATES) }), { maxItems: 5 }),
});

export const Revision = Obj({ version: DecimalString, updatedAt: Instant });

export const ReviewRevision = Obj({
  subjectId: Uuid,
  version: DecimalString,
  publishAt: T.Union([Instant, T.Null()]),
  visibility: Enum(['PENDING', 'PUBLISHED', 'WITHDRAWN'] as const),
});

export const ReconnectState = Obj({
  subjectId: Uuid,
  selected: T.Boolean(),
  version: DecimalString,
  connection: Enum(CONNECTION_STATES),
});

export const BlockState = Obj({ subjectId: Uuid, blocked: T.Boolean(), version: DecimalString });

export const ProductSurvey = Obj({
  version: DecimalString,
  again: T.Union([T.Boolean(), T.Null()]),
  reasons: UniqueArray(Enum(SURVEY_REASONS), 0, SURVEY_REASONS.length),
  submittedAt: T.Union([Instant, T.Null()]),
});

export const Notification = Obj({
  id: Uuid,
  template: T.String({ pattern: '^[a-z0-9_.]+$', maxLength: 80 }),
  createdAt: Instant,
  readAt: T.Union([Instant, T.Null()]),
  mealId: T.Union([Uuid, T.Null()]),
  applicationId: T.Union([Uuid, T.Null()]),
  conversationId: T.Union([Uuid, T.Null()]),
});

export const ReportReceipt = Obj({
  id: Uuid,
  receipt: T.String({ minLength: 8, maxLength: 64 }),
  status: Enum(REPORT_STATUSES),
  targetType: Enum(REPORT_TARGET_TYPES),
  publicOutcome: T.Union([T.String({ maxLength: 1000 }), T.Null()]),
  createdAt: Instant,
});

export const DeletionStatus = Obj({ status: Enum(DELETION_STATUSES), requestedAt: Instant, completedAt: T.Union([Instant, T.Null()]) });

export const SupportCase = Obj({
  id: Uuid,
  version: DecimalString,
  status: Enum(SUPPORT_CASE_STATUSES),
  reportId: T.Union([Uuid, T.Null()]),
  targetType: Enum(REPORT_TARGET_TYPES),
  targetId: Uuid,
  details: T.String({ maxLength: 1000 }),
  createdAt: Instant,
});

export const AttendanceCorrection = Obj({
  mealId: Uuid,
  subjectId: Uuid,
  value: Enum(ATTENDANCE_VALUES),
  version: DecimalString,
  correctedAt: Instant,
});

const DimensionOption = Obj({ code: T.String({ pattern: '^[a-z0-9_-]+$', maxLength: 64 }), label: T.String({ minLength: 1, maxLength: 120 }) });

/** Filter options as they exist in this sealed snapshot, so choices always match the pinned data. */
export const SnapshotDimensions = Obj({
  areas: T.Array(DimensionOption, { maxItems: 200 }),
  sources: T.Array(DimensionOption, { maxItems: 50 }),
});

export const SnapshotInfo = Obj({
  id: Uuid,
  dimensions: SnapshotDimensions,
  asOf: Instant,
  createdAt: Instant,
  definitionVersion: T.String({ maxLength: 20 }),
  classificationRevision: DecimalString,
  status: Enum(['SEALED', 'REVOKED'] as const),
});

export const Ratio = Obj({ numerator: T.Integer({ minimum: 0 }), denominator: T.Integer({ minimum: 0 }) });

/** Metric values are always numerator/denominator pairs so 0 denominators render “—” client-side. */
/** `metrics`/`series` keys must come from ADMIN_PAGE_KEYS[page] (checked server-side and in tests). */
export const AdminPageData = Obj({
  page: Enum(ADMIN_PAGES),
  snapshot: SnapshotInfo,
  filterHash: T.String({ pattern: '^[0-9a-f]{64}$' }),
  metrics: T.Record(T.String({ pattern: '^[a-z][a-zA-Z0-9_.]*$' }), T.Union([Ratio, T.Number(), T.Null()])),
  series: T.Record(T.String({ pattern: '^[a-z][a-zA-Z0-9_.]*$' }), T.Array(Obj({ key: T.String({ maxLength: 40 }), value: T.Union([Ratio, T.Number(), T.Null()]) }), { maxItems: 400 })),
  privacyExcludedCount: T.Integer({ minimum: 0 }),
});

export const DrilldownRow = Obj({
  rowId: T.String({ maxLength: 80 }),
  inNumerator: T.Boolean(),
  inDenominator: T.Boolean(),
  attributes: T.Record(T.String({ pattern: '^[a-z][a-zA-Z0-9_]*$' }), T.Union([T.String({ maxLength: 200 }), T.Number(), T.Boolean(), T.Null()])),
});

export const ExportTicket = Obj({ exportId: Uuid, snapshotId: Uuid, expiresAt: Instant });

export const Classification = Obj({ userId: Uuid, classification: Enum(CLASSIFICATIONS), revision: DecimalString, snapshotPending: T.Boolean() });

export const IngestResult = Obj({
  eventId: Uuid,
  status: Enum(['accepted', 'duplicate', 'rejected'] as const),
  reason: T.Optional(T.String({ maxLength: 120 })),
});

export const SessionInfo = Obj({
  user: Me,
  csrfToken: T.Optional(T.String({ minLength: 16, maxLength: 128 })),
  authTime: Instant,
  amr: UniqueArray(Enum(['otp', 'google', 'apple', 'mfa'] as const), 1, 4),
});

export const LinkedIdentity = Obj({ provider: Enum(['EMAIL', ...AUTH_PROVIDERS] as const), linkedAt: Instant });

export { LocalDate };

/**
 * P1.1 original-intent receipt (actor+operation+Idempotency-Key). Carries only status, codes,
 * ids and versions: never the request/response body, another person's choice or credentials.
 * NONE means no record exists (never arrived, released after a 5xx, or purged); it is not a
 * definitive failure, and clients must not mint a new key for the same intent because of it.
 */
export const CommandReceipt = Obj({
  operation: T.String({ pattern: '^[a-z][A-Za-z0-9]{1,63}$' }),
  key: Uuid,
  state: Enum(['NONE', 'PENDING', 'SUCCEEDED', 'REJECTED'] as const),
  /**
   * PENDING only: the previous attempt lost its lease, so the same key+body may be resent.
   * Always false once `expired`, because the server refuses any reuse of an expired key.
   */
  retryable: T.Boolean(),
  /**
   * The 30-day intent window has passed but the row is not yet purged. The stored outcome is
   * still reported; the key can never be replayed. Reload the resource and let the person confirm
   * a new intent explicitly (never auto-mint a key). An expired PENDING stays unresolved.
   */
  expired: T.Boolean(),
  retryAfterSeconds: T.Union([T.Integer({ minimum: 1, maximum: 60 }), T.Null()]),
  httpStatus: T.Union([T.Integer({ minimum: 200, maximum: 499 }), T.Null()]),
  errorCode: T.Union([T.String({ pattern: '^[A-Z][A-Z_]{1,63}$' }), T.Null()]),
  /** 409 class: VERSION (reload and re-confirm), IN_PROGRESS (keep polling), PAYLOAD (key reused), STATE (business rule). */
  conflict: T.Union([Enum(['VERSION', 'IN_PROGRESS', 'PAYLOAD', 'STATE'] as const), T.Null()]),
  resourceId: T.Union([Uuid, T.Null()]),
  resourceVersion: T.Union([DecimalString, T.Null()]),
  currentVersion: T.Union([DecimalString, T.Null()]),
  completedAt: T.Union([Instant, T.Null()]),
  expiresAt: T.Union([Instant, T.Null()]),
});
