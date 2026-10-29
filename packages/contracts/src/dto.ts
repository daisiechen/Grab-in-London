/** Response DTOs (API contract §1). Public projections are explicit allowlists. */
import { DecimalString, Enum, Instant, LocalDate, Obj, Pence, T, Text, UniqueArray, Uuid } from './schema.ts';
import { ZonedTime } from './common.ts';
import {
  ADMIN_PAGES, APPLICATION_STATES, ATTENDANCE_SOURCES, ATTENDANCE_VALUES, AUTH_PROVIDERS, BOOKING_DECLARATION_STATUSES,
  BOOKING_MODES, CANCEL_REASONS, CLASSIFICATIONS, CONNECTION_STATES, CONVERSATION_KINDS, CUISINES, DELETION_STATUSES,
  DIETARY, INTERESTS, LANGUAGE_CODES, LIFE_STATUSES, MEAL_ACTIONS, MEAL_STATUSES, MOODS, REPORT_STATUSES,
  REPORT_TARGET_TYPES, ROLES, SUPPORT_CASE_STATUSES, SURVEY_REASONS, ACCOUNT_STATUSES, MODERATION_ACTIONS, MODERATION_HISTORY_KINDS,
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
/**
 * Public URL of a member-uploaded profile photo (owner decision 2026-10-28, replacing the r07
 * sample portraits): `<API public origin>/v1/avatars/<imageId>`; null shows initials.
 */
export const AvatarUrl = T.Union([T.String({ format: 'uri', maxLength: 500 }), T.Null()]);

export const Background = Obj({
  work: T.Optional(Text(1, 150)),
  school: T.Optional(Text(1, 150)),
  hometown: T.Optional(Text(1, 150)),
});

export const PublicProfile = Obj({
  id: Uuid,
  displayName: Text(2, 40),
  avatarUrl: AvatarUrl,
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
  avatarUrl: AvatarUrl,
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
  /** Public projection of everyone holding a seat now (host first, then guests by name); shown as “Who’s coming”. */
  members: T.Array(PublicProfile, { maxItems: 6 }),
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
  /** Group chat the viewer can read for this meal (same rule as getMeal), else null. */
  conversationId: T.Union([Uuid, T.Null()]),
});

export const Message = Obj({
  id: Uuid,
  seq: DecimalString,
  sender: PublicProfile,
  body: T.String({ minLength: 1, maxLength: 2000 }),
  createdAt: Instant,
  redacted: T.Boolean(),
});

/** Who a conversation row shows: the other member (DIRECT) or the host (GROUP); null when unavailable. */
export const ConversationAvatar = Obj({
  displayName: T.String({ minLength: 1, maxLength: 40 }),
  avatarUrl: AvatarUrl,
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
  avatar: T.Union([ConversationAvatar, T.Null()]),
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
/** A member the caller currently blocks (own list only; never reveals the other member's choices). */
export const BlockedMember = Obj({ profile: PublicProfile, version: DecimalString, blockedAt: Instant });

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

/**
 * Moderation queue row (support role). Metadata only: no report text, names or contact details.
 * dueAt = createdAt + MODERATION_SLA_HOURS; autoActioned = the server limited the content after
 * repeated reports and the case awaits review; autoClosed = closed after 30 days without staff action.
 */
export const ModerationReportSummary = Obj({
  reportId: Uuid,
  caseId: Uuid,
  caseVersion: DecimalString,
  targetType: Enum(REPORT_TARGET_TYPES),
  reason: T.String({ maxLength: 40 }),
  reportStatus: Enum(REPORT_STATUSES),
  caseStatus: Enum(SUPPORT_CASE_STATUSES),
  createdAt: Instant,
  dueAt: Instant,
  autoActioned: T.Boolean(),
  autoClosed: T.Boolean(),
  contentLimited: T.Boolean(),
  /** Distinct members who reported the same target in the last 7 days. */
  reporterCount: T.Integer({ minimum: 0 }),
  claimedByMe: T.Boolean(),
  subjectStatus: T.Union([Enum(ACCOUNT_STATUSES), T.Null()]),
});

/** Public fields of a reported profile as staff need them to decide; never email/contact data. */
export const ModerationUser = Obj({
  userId: Uuid,
  accountStatus: Enum(ACCOUNT_STATUSES),
  displayName: T.Union([T.String({ maxLength: 40 }), T.Null()]),
  bio: T.Union([T.String({ maxLength: 1000 }), T.Null()]),
  hasPhoto: T.Boolean(),
  /** Staff-only photo URL (GET .../photo); null when there is no photo. */
  photoUrl: T.Union([T.String({ maxLength: 500 }), T.Null()]),
  languages: UniqueArray(LanguageCode, 0, 5),
  interests: UniqueArray(InterestCode, 0, 11),
  profileHidden: T.Boolean(),
});

export const ModerationMeal = Obj({
  mealId: Uuid,
  hostId: Uuid,
  title: T.String({ maxLength: 200 }),
  description: T.String({ maxLength: 2000 }),
  status: Enum(MEAL_STATUSES),
  startsAt: Instant,
  areaCode: AreaCode,
  hidden: T.Boolean(),
});

export const ModerationMessageLine = Obj({
  messageId: Uuid,
  senderId: Uuid,
  /** Text from a deleted account is withheld for privacy. */
  body: T.String({ maxLength: 2000 }),
  createdAt: Instant,
  hidden: T.Boolean(),
  isTarget: T.Boolean(),
});

export const ModerationMessage = Obj({
  messageId: Uuid,
  conversationId: Uuid,
  senderId: Uuid,
  hidden: T.Boolean(),
  /** Up to three messages before and after the reported one, oldest first. */
  context: T.Array(ModerationMessageLine, { maxItems: 7 }),
});

export const ModerationHistoryEntry = Obj({
  id: Uuid,
  kind: Enum(MODERATION_HISTORY_KINDS),
  /** null = automatic (system) step. */
  actorId: T.Union([Uuid, T.Null()]),
  note: T.Union([T.String({ maxLength: 1000 }), T.Null()]),
  publicOutcome: T.Union([T.String({ maxLength: 1000 }), T.Null()]),
  createdAt: Instant,
});

export const ModerationReport = Obj({
  summary: ModerationReportSummary,
  reporterId: Uuid,
  details: T.String({ maxLength: 1000 }),
  publicOutcome: T.Union([T.String({ maxLength: 1000 }), T.Null()]),
  /** Reporter or responsible account was deleted: free text is withheld and only closing actions remain. */
  privacyRedacted: T.Boolean(),
  /** The account a suspension would apply to (the profile, the meal host or the message sender). */
  subject: T.Union([Obj({ userId: Uuid, accountStatus: Enum(ACCOUNT_STATUSES) }), T.Null()]),
  user: T.Union([ModerationUser, T.Null()]),
  meal: T.Union([ModerationMeal, T.Null()]),
  message: T.Union([ModerationMessage, T.Null()]),
  history: T.Array(ModerationHistoryEntry, { maxItems: 200 }),
  allowedActions: UniqueArray(Enum(MODERATION_ACTIONS), 0, MODERATION_ACTIONS.length),
});

/** Start-roster attendance facts for a MEAL case (J09), with the effective revision used as expectedVersion. */
export const CaseAttendance = Obj({
  caseId: Uuid,
  mealId: Uuid,
  mealStatus: Enum(MEAL_STATUSES),
  scheduledEndAt: Instant,
  /** scheduledEndAt + 7 days: support corrections are accepted from this instant. */
  correctionOpensAt: Instant,
  roster: T.Array(Obj({
    subjectId: Uuid,
    isHost: T.Boolean(),
    selfValue: T.Union([Enum(ATTENDANCE_VALUES), T.Null()]),
    hostValue: T.Union([Enum(ATTENDANCE_VALUES), T.Null()]),
    supportValue: T.Union([Enum(ATTENDANCE_VALUES), T.Null()]),
    value: Enum(['present', 'absent', 'unknown'] as const),
    source: T.Union([Enum(ATTENDANCE_SOURCES), T.Null()]),
    version: DecimalString,
  }), { maxItems: 20 }),
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
