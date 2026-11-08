/**
 * Versioned dictionaries shared by host forms, discovery filters, analytics and AI validation.
 * Values come from the existing prototype options (demo/src/Prototype.tsx) and data contract §5–6;
 * adding a value is a contract change and must be registered and tested here.
 */
export const DICTIONARY_VERSION = '2026-10-21.1';

export const LANGUAGES = { en: 'English', zh: 'Chinese', fr: 'French', es: 'Spanish', hi: 'Hindi' } as const;
export type LanguageCode = keyof typeof LANGUAGES;
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];

/** Explicit legacy label mapping; never split arbitrary strings at runtime. */
export const LEGACY_LANGUAGE_LABELS: Readonly<Record<string, readonly LanguageCode[]>> = {
  English: ['en'],
  Mandarin: ['zh'],
  Chinese: ['zh'],
  中文: ['zh'],
  French: ['fr'],
  Spanish: ['es'],
  Hindi: ['hi'],
  'English & Mandarin': ['en', 'zh'],
  'English & French': ['en', 'fr'],
};

export const MOODS = {
  EASY_CONVERSATION: 'Easy conversation',
  FOOD_DISCOVERIES: 'Food discoveries',
  TRAVEL_CULTURE: 'Travel & culture',
} as const;
export type MoodCode = keyof typeof MOODS;

/** P-05: host-declared, optional; null means not provided. Not inferred from Places or names. */
export const CUISINES = { EUROPEAN: 'European', JAPANESE: 'Japanese', SPANISH: 'Spanish', CHINESE: 'Chinese' } as const;
export type CuisineCode = keyof typeof CUISINES;
export const DIETARY = { VEGETARIAN_OPTIONS: 'Vegetarian options', VEGAN: 'Vegan' } as const;
export type DietaryCode = keyof typeof DIETARY;

export const LIFE_STATUSES = {
  NEW_TO_LONDON: 'New to London',
  MAKING_LONDON_HOME: 'Making London home',
  LIVING_AND_WORKING: 'Living and working in London',
  STUDYING: 'Studying in London',
  VISITING: 'Visiting London',
} as const;
export type LifeStatusCode = keyof typeof LIFE_STATUSES;

export const INTERESTS = {
  FOOD: 'Food', PHOTOGRAPHY: 'Photography', TRAVEL: 'Travel', DESIGN: 'Design', BOOKS: 'Books',
  CINEMA: 'Cinema', WALKING: 'Walking', COOKING: 'Cooking', MUSIC: 'Music', ART: 'Art', SPORT: 'Sport',
} as const;
export type InterestCode = keyof typeof INTERESTS;

/** ProductSurvey factors — measurement contract v4 §ProductSurvey, fixed order. */
export const SURVEY_REASONS = ['company', 'conversation', 'coordination', 'expectations', 'venue', 'cost', 'other'] as const;
/** The five existing admin pages (admin/src/App.tsx); no new pages. */
export const ADMIN_PAGES = ['overview', 'journey', 'supply', 'retention', 'quality'] as const;
export const CLASSIFICATIONS = ['regular', 'test', 'staff'] as const;
export const ROLES = ['analyst', 'data_admin', 'support'] as const;

export const MEAL_STATUSES = ['OPEN', 'CANCELLED', 'COMPLETED'] as const;
export const CANCEL_REASONS = ['host', 'booking', 'other', 'insufficient'] as const;
/** Reasons a host may submit; `insufficient` is system-only. */
export const HOST_CANCEL_REASONS = ['host', 'booking', 'other'] as const;
export const APPLICATION_STATES = ['PENDING', 'CONFIRMED', 'DECLINED', 'WITHDRAWN', 'EXPIRED', 'CANCELLED'] as const;
export const BOOKING_DECLARATION_STATUSES = ['REPORTED_CONFIRMED', 'NEEDS_UPDATE', 'FAILED', 'CANCELLED'] as const;
export const BOOKING_MODES = ['EXTERNAL_PAY_AT_VENUE'] as const;
export const MY_MEAL_SECTIONS = ['UPCOMING', 'APPLICATIONS', 'HOSTING', 'PAST', 'CANCELLED'] as const;
export const TIME_OF_DAY = ['any', 'lunch', 'dinner'] as const;
export const ATTENDANCE_VALUES = ['present', 'absent'] as const;
export const ATTENDANCE_SOURCES = ['SELF', 'HOST', 'SUPPORT'] as const;
export const CONNECTION_STATES = ['OPEN', 'WAITING', 'CLOSED'] as const;
export const REPORT_TARGET_TYPES = ['USER', 'MEAL', 'MESSAGE'] as const;
/**
 * Report reasons the apps offer (owner decision 2026-10-29): personal safety or threats, harassment or
 * hate, scam/spam/advertising, may be under 18, other. Each report also carries private free text.
 */
export const REPORT_REASONS = ['safety', 'harassment', 'scam', 'under_18', 'other'] as const;
/** Reasons that put a report first in the staff queue and trigger an immediate alert. */
export const URGENT_REPORT_REASONS = ['safety', 'harassment', 'under_18'] as const;
/**
 * The single reason used before 2026-10-29. Stored rows keep it (shown as `other`), and createReport
 * still accepts it from older app builds and the web sheet; new clients send one of REPORT_REASONS.
 */
export const LEGACY_REPORT_REASON = 'private_concern' as const;
/** Values createReport accepts. */
export const REPORT_REASON_INPUTS = [...REPORT_REASONS, LEGACY_REPORT_REASON] as const;
export const isUrgentReportReason = (reason: string): reason is (typeof URGENT_REPORT_REASONS)[number] =>
  (URGENT_REPORT_REASONS as readonly string[]).includes(reason);
export const REPORT_STATUSES = ['RECEIVED', 'IN_REVIEW', 'RESPONDED'] as const;
export const DELETION_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'NEEDS_SUPPORT'] as const;
export const SUPPORT_CASE_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED'] as const;
/** Account lifecycle as staff see it; SUSPENDED is a reversible moderation state (owner decision 2026-10-28). */
export const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED', 'DELETING', 'DELETED'] as const;
/**
 * Staff moderation actions (App Store guideline 1.2 back office, owner decision 2026-10-28).
 * UPHOLD keeps/applies the content limit and closes; RESTORE lifts any limit and closes (no breach);
 * SUSPEND_USER suspends the responsible account, keeps the limit and closes. The rest change one
 * thing and close only when asked to.
 */
export const MODERATION_ACTIONS = ['UPHOLD', 'RESTORE', 'HIDE_CONTENT', 'CANCEL_MEAL', 'RESET_PROFILE_TEXT', 'REMOVE_PROFILE_PHOTO', 'SUSPEND_USER', 'UNSUSPEND_USER'] as const;
/** History rows also carry the automatic steps the server takes on its own. */
export const MODERATION_HISTORY_KINDS = [...MODERATION_ACTIONS, 'AUTO_HIDE', 'AUTO_CLOSE', 'CASE_STATUS', 'ATTENDANCE_CORRECTED'] as const;
export const MODERATION_QUEUE_STATUSES = ['OPEN', 'RESOLVED', 'ALL'] as const;
/** Staff response target shown in the queue; a case is overdue 24 hours after the report. */
export const MODERATION_SLA_HOURS = 24;
export const AUTH_PROVIDERS = ['GOOGLE', 'APPLE'] as const;
export const CLIENT_KINDS = ['WEB', 'IOS', 'SUPPORT_CLI'] as const;
export const CONVERSATION_KINDS = ['GROUP', 'DIRECT'] as const;
export const MESSAGE_READ_MODES = ['HISTORY', 'LIVE'] as const;

/** Client-observed analytics events only; business success comes from server facts (C-01, T20). */
export const CLIENT_EVENT_TYPES = [
  'discovery_results', 'discovery_failed', 'meal_impression', 'detail_view', 'create_started',
  'create_arranged', 'form_error', 'filter_applied', 'map_opened', 'profile_view', 'chat_opened',
] as const;

/** Server-computed hints only; the server re-validates every action. */
export const MEAL_ACTIONS = [
  'APPLY', 'WITHDRAW', 'LEAVE', 'EDIT', 'CANCEL', 'DECLARE_BOOKING', 'REVIEW_APPLICATIONS', 'OPEN_GROUP', 'POST_MEAL',
] as const;

/**
 * Admin key registry shared by the five pages and the snapshot worker (T21): metric cards, chart
 * series and drill-down lists per page. Ids follow the prototype (admin/src/metrics.ts) and the
 * measurement contract rows; formulas live in the worker, never in the UI.
 * v5 (ops analytics review 2026-10-29): overview "this week" row from server facts only
 * (signups, mealsPublished, firstApplications, mealsHeld, weekly); "approved" merged into "confirmed"
 * (approval confirms the seat in the first release); consentCoverage on the quality page, and on every
 * page with consent-sample cards so their footnotes can cite it (it is not drawn as a card there).
 */
export const ADMIN_PAGE_KEYS = {
  overview: { metrics: ['signups', 'mealsPublished', 'firstApplications', 'mealsHeld', 'weekly', 'activation', 'retention', 'coverage'], series: ['weekly.trend', 'ops.previousWeek', 'signups.platform'] },
  journey: {
    metrics: ['discovery7', 'impressionNoApply', 'applications', 'confirmed', 'applicationAttendance', 'approval', 'approvalP50', 'pendingApplications', 'oldestPendingHours', 'formErrors', 'consentCoverage'],
    series: ['funnel.join', 'funnel.create', 'browse.people', 'features.usage', 'form.errors.byStep', 'form.errors.byField'],
  },
  supply: {
    metrics: ['discovery', 'formation', 'cancellation', 'coverage', 'mealsWithAttendance', 'consentCoverage'],
    series: ['area.compare', 'cancellation.reasons', 'attendance.distribution'],
  },
  retention: {
    metrics: ['retention', 'activation', 'feedback', 'survey', 'laterOpportunity', 'consentCoverage'],
    series: ['cohort.retention', 'rating.distribution', 'survey.reasons'],
  },
  quality: { metrics: ['missingRequired', 'duplicates', 'excluded', 'receiveLatencyP90', 'consentCoverage'], series: ['quality.sources'] },
} as const satisfies Record<(typeof ADMIN_PAGES)[number], { metrics: readonly string[]; series: readonly string[] }>;

/** Overview "this week" row (London week of the snapshot, Monday start); all server facts, no consent needed. */
export const ADMIN_OPS_WEEK_METRICS = ['signups', 'mealsPublished', 'firstApplications', 'mealsHeld', 'weekly'] as const;
/**
 * Metrics and series computed from consented analytics events only. They describe the consent sample,
 * are labelled as such in the admin, and are never divided by server-wide totals.
 */
export const ADMIN_CONSENT_SAMPLE_KEYS = [
  'discovery', 'discovery7', 'impressionNoApply', 'laterOpportunity', 'formErrors',
  'browse.people', 'features.usage', 'funnel.create', 'form.errors.byStep', 'form.errors.byField',
] as const;
/** Current measurement definition version sealed into new snapshots. */
export const ADMIN_DEFINITION_VERSION = 'v5';

/** Drill-down targets: every metric id plus the source lists the pages open in drawers. */
export const ADMIN_LISTS = ['meals', 'applications', 'cohort.users', 'attendance', 'quality.events'] as const;
export const ADMIN_METRIC_IDS = [...new Set(Object.values(ADMIN_PAGE_KEYS).flatMap((p) => [...p.metrics]))];
export const ADMIN_DRILLDOWN_TARGETS = [...ADMIN_METRIC_IDS, ...ADMIN_LISTS];
/** User segment filter (prototype `segment`): joined inside the date range vs before it. */
export const ADMIN_SEGMENTS = ['new', 'existing'] as const;
export const ADMIN_DRILLDOWN_SORTS = ['occurredAt', 'startsAt', 'appliedAt', 'area', 'status'] as const;
