export const DEFINITION_VERSION = "4";
export const SNAPSHOT = "2026-10-18T12:00:00Z";
export const DAY = 86_400_000;
export type AccountType = "regular" | "test" | "staff";
export type User = { id: string; joinedAt: string; accountType?: AccountType };
export type Meal = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  closesAt?: string;
  cancelledAt?: string;
  publishedAt: string;
  area: string;
  language: string;
  capacity: number;
  minimum: number;
  budget: number;
  source: "user" | "assisted";
  hostId: string;
  cancelled: boolean;
  cancelReason?: string;
  peakConfirmed: number;
};
export type Application = {
  id: string;
  userId: string;
  mealId: string;
  appliedAt: string;
  decidedAt?: string;
  decision?: "approved" | "declined";
  confirmedAt?: string;
  withdrawnAt?: string;
  expiredAt?: string;
};
export function applicationState(data: Dataset, a: Application, asOf = SNAPSHOT) {
  if (a.withdrawnAt && a.withdrawnAt <= asOf) return "withdrawn";
  if (a.confirmedAt && a.confirmedAt <= asOf) return "confirmed";
  if (a.decision === "declined" && a.decidedAt && a.decidedAt <= asOf) return "declined";
  const meal = data.meals.find((m) => m.id === a.mealId);
  if ((a.expiredAt && a.expiredAt <= asOf) || (meal?.closesAt && meal.closesAt <= asOf) || (meal?.cancelled && (!meal.cancelledAt || meal.cancelledAt <= asOf))) return "expired";
  return "pending";
}
export type AttendanceRecord = {
  userId: string;
  mealId: string;
  host?: "present" | "absent";
  self?: "present" | "absent";
  correction?: { result: "present" | "absent"; caseId: string; actorId: string; reason: string };
  updatedAt: string;
};
export type MealExperience = {
  userId: string;
  mealId: string;
  score: number;
  at: string;
};
export type Feedback = MealExperience;
export const surveyReasons = ["company", "conversation", "coordination", "expectations", "venue", "cost", "other"] as const;
export type ProductSurvey = {
  userId: string;
  again: boolean | null;
  reasons: string[];
  submittedAt: string;
};
// Select the latest valid version per user at asOf, then cohort by its submission date.
// Meal dimensions cannot be attributed to a product-level questionnaire.
export function productSurveys(data: Dataset, f: Filters, asOf = SNAPSHOT) {
  const latest = new Map<string, ProductSurvey>();
  for (const row of [...(data.surveys || [])].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))) {
    if (!data.users.some((u) => u.id === row.userId) || !regularUser(data, row.userId) ||
        !Number.isFinite(+new Date(row.submittedAt)) || row.submittedAt > asOf ||
        !(row.again === null || typeof row.again === "boolean") ||
        !Array.isArray(row.reasons) || row.reasons.some((reason) => !surveyReasons.includes(reason as typeof surveyReasons[number])) ||
        (row.again === null && row.reasons.length === 0)) continue;
    latest.set(row.userId, {...row, reasons: [...new Set(row.reasons)]});
  }
  const responses = [...latest.values()].filter((row) => within(row.submittedAt, f) && userMatches(data, row.userId, f));
  const answered = responses.filter((row) => row.again !== null);
  return {
    responses,
    unanswered: responses.length - answered.length,
    again: { numerator: answered.filter((row) => row.again === true).length, denominator: answered.length },
  };
}
export type Event = {
  id: string;
  name: string;
  occurredAt: string;
  receivedAt: string;
  userId?: string;
  anonymousId?: string;
  sessionId: string;
  mealId?: string;
  attemptId?: string;
  environment: "production" | "demo";
  appVersion: string;
  schemaVersion: number;
  isTest?: boolean;
  isBot?: boolean;
  isStaff?: boolean;
  resultCount?: number;
  area?: string;
  language?: string;
  budget?: number;
  size?: number;
  source?: string;
  field?: string;
  durationMs?: number;
  visibleRatio?: number;
};
export type IdentityLink = {
  anonymousId: string;
  sessionId: string;
  userId: string;
};
export type Dataset = {
  users: User[];
  meals: Meal[];
  applications: Application[];
  attendance: AttendanceRecord[];
  feedback: Feedback[];
  surveys?: ProductSurvey[];
  events: Event[];
  identityLinks?: IdentityLink[];
};
export type Filters = {
  start: string;
  end: string;
  area: string;
  source: string;
  language: string;
  size: string;
  budget: string;
  segment: string;
};
export const defaultFilters: Filters = {
  start: "2026-09-21",
  end: "2026-10-18",
  area: "all",
  source: "all",
  language: "all",
  size: "all",
  budget: "all",
  segment: "all",
};
const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function londonDay(iso: string) {
  const parts = dayFormatter.formatToParts(new Date(iso));
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export function weekStart(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
export const within = (iso: string, f: Filters) =>
  londonDay(iso) >= f.start && londonDay(iso) <= f.end;
export const ratio = (n: number, d: number) => (d ? n / d : null);
export function validEvent(e: Event) {
  return (
    !!(
      e.id &&
      e.name &&
      e.sessionId &&
      e.schemaVersion &&
      e.appVersion &&
      e.occurredAt &&
      e.receivedAt
    ) &&
    !Number.isNaN(+new Date(e.occurredAt)) &&
    !Number.isNaN(+new Date(e.receivedAt)) &&
    (e.name !== "discovery_results" || (Number.isInteger(e.resultCount) && e.resultCount! >= 0))
  );
}
export function cleanEvents(
  events: Event[],
  links: IdentityLink[] = [],
  asOf = SNAPSHOT,
) {
  const seen = new Set<string>();
  return events
    .filter((e) => {
      if (
        !validEvent(e) ||
        e.environment !== "production" ||
        e.isTest ||
        e.isBot ||
        e.isStaff ||
        seen.has(e.id) ||
        e.receivedAt > asOf ||
        e.occurredAt > asOf
      )
        return false;
      seen.add(e.id);
      return true;
    })
    .map((e) => ({
      ...e,
      userId:
        e.userId ||
        links.find(
          (l) => l.sessionId === e.sessionId && l.anonymousId === e.anonymousId,
        )?.userId,
    }));
}
// Resolve facts, never treat source disagreement or silence as absence.
export function attendance(record?: AttendanceRecord): "present" | "absent" | "unknown" {
  return record?.correction?.result || record?.self || record?.host || "unknown";
}
export function latestAttendance(data: Dataset, userId: string, mealId: string, asOf = SNAPSHOT) {
  const records = data.attendance.map((a, index) => ({ ...a, index }))
    .filter((a) => a.userId === userId && a.mealId === mealId && a.updatedAt <= asOf)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.index - b.index);
  if (!records.length) return undefined;
  // Host and self are independent streams; a host update cannot erase a self report.
  return records.reduce<AttendanceRecord>((latest, record) => ({ ...latest, ...record }), { userId, mealId, updatedAt: "" });
}
export function sourceDifference(record?: AttendanceRecord) {
  return !!(record?.self && record?.host && record.self !== record.host);
}
export const selectedValues = (value: string) => value === "all" ? [] : value.split(",");
export const matchesChoice = (filter: string, value: string) => filter === "all" || selectedValues(filter).includes(value);
export function budgetBand(budget?: number) {
  return budget === undefined || !Number.isFinite(budget) || budget < 0 ? "unknown"
    : budget <= 20 ? "0-20" : budget <= 30 ? "20-30" : budget <= 40 ? "30-40" : "40+";
}
export function matchesLanguage(filter: string, language?: string) {
  if (filter === "all") return true;
  const codes = (language || "").replace(/Mandarin|中文/g, "Chinese").split(/\s*(?:\/|&|,)\s*/);
  return selectedValues(filter).some((v) => codes.includes(v));
}
export function matchesSize(filter: string, size?: number) {
  return filter === "all" || selectedValues(filter).some((v) => v === "duo" ? size === 2 : v === "group" ? size !== undefined && size >= 3 && size <= 6 : v === "7+" ? size !== undefined && size >= 7 : size === Number(v));
}
export function matchesBudget(filter: string, budget?: number) {
  if (filter === "all") return true;
  // Retain old shared URLs with a numeric upper bound.
  if (/^\d+$/.test(filter)) return budget !== undefined && budget <= Number(filter);
  return matchesChoice(filter, budgetBand(budget));
}
export function regularUser(data: Dataset, id: string) {
  const kind = data.users.find((u) => u.id === id)?.accountType;
  return !kind || kind === "regular";
}
export function analyticalData(data: Dataset): Dataset {
  const meals = data.meals.filter((m) => regularUser(data, m.hostId));
  const ids = new Set(meals.map((m) => m.id));
  const allowed = (u: string, m: string) => regularUser(data, u) && ids.has(m);
  return { ...data, meals,
    users: data.users,
    applications: data.applications.filter((a) => allowed(a.userId, a.mealId)),
    attendance: data.attendance.filter((a) => allowed(a.userId, a.mealId)),
    feedback: data.feedback.filter((a) => allowed(a.userId, a.mealId)),
    surveys: (data.surveys || []).filter((r) => regularUser(data, r.userId)),
    events: data.events.filter((e) => (!e.userId || regularUser(data, e.userId)) && (!e.mealId || ids.has(e.mealId))),
    identityLinks: data.identityLinks,
  };
}
function mealMatches(meal: Meal, f: Filters) {
  return matchesChoice(f.area, meal.area) && matchesChoice(f.source, meal.source)
    && matchesLanguage(f.language, meal.language) && matchesSize(f.size, meal.capacity) && matchesBudget(f.budget, meal.budget);
}
export function userMatches(data: Dataset, userId: string, f: Filters) {
  const u = data.users.find((u) => u.id === userId);
  return (
    regularUser(data, userId) && (f.segment === "all" ||
    (!!u && matchesChoice(f.segment, within(u.joinedAt, f) ? "new" : londonDay(u.joinedAt) < f.start ? "existing" : "future")))
  );
}
export function peakBeforeStart(data: Dataset, meal: Meal, asOf = SNAPSHOT) {
  const rows = data.applications.filter((a) => a.mealId === meal.id && regularUser(data, a.userId) && a.confirmedAt && a.confirmedAt < meal.startsAt && a.confirmedAt <= asOf && (!a.withdrawnAt || a.withdrawnAt > a.confirmedAt));
  return Math.max(1, ...rows.map((at) => 1 + new Set(rows.filter((a) => a.confirmedAt! <= at.confirmedAt! && (!a.withdrawnAt || a.withdrawnAt > at.confirmedAt!)).map((a) => a.userId).filter((id) => id !== meal.hostId)).size));
}
export function filterMeals(data: Dataset, f: Filters, asOf = SNAPSHOT) {
  data = analyticalData(data);
  return data.meals.filter(
    (m) => m.publishedAt <= asOf && within(m.startsAt, f) && mealMatches(m, f),
  ).map((m) => ({...m, peakConfirmed: peakBeforeStart(data, m, asOf)}));
}
export function filteredEvents(data: Dataset, f: Filters, asOf = SNAPSHOT) {
  data = analyticalData(data);
  return cleanEvents(data.events, data.identityLinks, asOf).filter((e) => {
    if (e.userId && !regularUser(data, e.userId)) return false;
    if (!within(e.occurredAt, f) || !userMatches(data, e.userId || "", f))
      return false;
    const m = data.meals.find((m) => m.id === e.mealId);
    if (m) return mealMatches(m, f);
    return matchesChoice(f.area, e.area || "unknown") && matchesChoice(f.source, e.source || "unknown")
      && matchesLanguage(f.language, e.language) && matchesSize(f.size, e.size) && matchesBudget(f.budget, e.budget);
  });
}
export const mealEnded = (meal: Meal, asOf = SNAPSHOT) => +new Date(meal.endsAt || new Date(+new Date(meal.startsAt) + 2 * 3_600_000).toISOString()) <= +new Date(asOf);
export function participation(data: Dataset, asOf = SNAPSHOT) {
  data = analyticalData(data);
  const result: {
    userId: string;
    meal: Meal;
    status: ReturnType<typeof attendance>;
  }[] = [];
  for (const meal of data.meals.filter(
    (m) => !m.cancelled && mealEnded(m, asOf) && m.publishedAt <= asOf,
  )) {
    const people = new Set([
      meal.hostId,
      ...data.applications
        .filter(
          (a) =>
            a.mealId === meal.id &&
            a.confirmedAt &&
            a.confirmedAt <= asOf && a.confirmedAt < meal.startsAt &&
            (!a.withdrawnAt || a.withdrawnAt > meal.startsAt),
        )
        .map((a) => a.userId),
    ]);
    for (const userId of people)
      result.push({
        userId,
        meal,
        status: attendance(latestAttendance(data, userId, meal.id, asOf)),
      });
  }
  return result;
}
function firstAttendance(data: Dataset, asOf: string) {
  const first = new Map<string, Meal>();
  for (const p of participation(data, asOf)
    .filter((p) => p.status === "present")
    .sort((a, b) => a.meal.startsAt.localeCompare(b.meal.startsAt)))
    if (!first.has(p.userId)) first.set(p.userId, p.meal);
  return first;
}
export function activationUsers(data: Dataset, f: Filters, asOf = SNAPSHOT) {
  data = analyticalData(data);
  const first = new Map<string, Application>();
  for (const a of [...data.applications]
    .filter((a) => a.appliedAt <= asOf)
    .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt)))
    if (!first.has(a.userId)) first.set(a.userId, a);
  const attended = firstAttendance(data, asOf);
  return [...first.values()]
    .filter(
      (a) =>
        within(a.appliedAt, f) &&
        userMatches(data, a.userId, f) &&
        data.meals.some((m) => m.id === a.mealId && mealMatches(m, f)),
    )
    .map((a) => {
      const firstMeal = attended.get(a.userId);
      return {
        ...a,
        mature: +new Date(a.appliedAt) + 14 * DAY <= +new Date(asOf),
        converted:
          !!firstMeal &&
          +new Date(firstMeal.startsAt) >= +new Date(a.appliedAt) &&
          +new Date(firstMeal.startsAt) <= +new Date(a.appliedAt) + 14 * DAY,
      };
    });
}
export function cohorts(data: Dataset, f: Filters, asOf = SNAPSHOT) {
  data = analyticalData(data);
  const first = firstAttendance(data, asOf),
    parts = participation(data, asOf).filter((p) => p.status === "present");
  const grouped = new Map<
    string,
    {
      week: string;
      total: number;
      mature: number;
      repeat: number;
      opportunity: number;
      users: string[];
      members: {
        userId: string;
        firstAt: string;
        mature: boolean;
        repeat: boolean;
        opportunity: boolean;
      }[];
    }
  >();
  for (const [userId, meal] of first) {
    if (
      !within(meal.startsAt, f) ||
      !mealMatches(meal, f) ||
      !userMatches(data, userId, f)
    )
      continue;
    const week = weekStart(londonDay(meal.startsAt));
    const row = grouped.get(week) || {
      week,
      total: 0,
      mature: 0,
      repeat: 0,
      opportunity: 0,
      users: [],
      members: [],
    };
    const beforeRepeat = row.repeat,
      beforeOpportunity = row.opportunity;
    row.total++;
    row.users.push(userId);
    const end = +new Date(meal.startsAt) + 30 * DAY;
    if (end <= +new Date(asOf)) {
      row.mature++;
      if (
        parts.some(
          (p) =>
            p.userId === userId &&
            p.meal.id !== meal.id &&
            p.meal.startsAt > meal.startsAt &&
            +new Date(p.meal.startsAt) <= end,
        )
      )
        row.repeat++;
      // Opportunity is observed exposure, not inferred availability or inferred compatibility.
      if (
        cleanEvents(data.events, data.identityLinks, asOf).some(
          (e) =>
            e.userId === userId &&
            e.name === "meal_impression" &&
            (e.durationMs || 0) >= 1000 &&
            (e.visibleRatio || 0) >= 0.5 &&
            e.mealId !== meal.id &&
            e.occurredAt > meal.startsAt &&
            +new Date(e.occurredAt) <= end &&
            data.meals.some(
              (m) =>
                m.id === e.mealId &&
                m.hostId !== userId &&
                m.startsAt > e.occurredAt &&
                !m.cancelled,
            ),
        )
      )
        row.opportunity++;
    }
    row.members.push({
      userId,
      firstAt: meal.startsAt,
      mature: end <= +new Date(asOf),
      repeat: row.repeat > beforeRepeat,
      opportunity: row.opportunity > beforeOpportunity,
    });
    grouped.set(week, row);
  }
  return [...grouped.values()].sort((a, b) => a.week.localeCompare(b.week));
}
export function summarize(data: Dataset, f: Filters, asOf = SNAPSHOT) {
  data = analyticalData(data);
  const meals = filterMeals(data, f, asOf).filter((m) => m.startsAt <= asOf);
  const mealIds = new Set(meals.map((m) => m.id));
  const parts = participation(data, asOf).filter(
    (p) => mealIds.has(p.meal.id) && userMatches(data, p.userId, f),
  );
  const states = { present: 0, absent: 0, unknown: 0 };
  parts.forEach((p) => states[p.status]++);
  const weeks = new Map<string, Set<string>>();
  for (const meal of meals)
    weeks.set(weekStart(londonDay(meal.startsAt)), new Set<string>());
  for (const p of parts.filter((p) => p.status === "present")) {
    const w = weekStart(londonDay(p.meal.startsAt));
    const set = weeks.get(w) || new Set<string>();
    set.add(p.userId);
    weeks.set(w, set);
  }
  const activation = activationUsers(data, f, asOf).filter((a) => a.mature),
    retention = cohorts(data, f, asOf);
  const events = filteredEvents(data, f, asOf),
    discoveries = events.filter((e) => e.name === "discovery_results" && Number.isInteger(e.resultCount) && e.resultCount! >= 0);
  const feedbackMap = new Map<string, Feedback>();
  for (const r of [...data.feedback].sort((a, b) => a.at.localeCompare(b.at)))
    if (
      mealIds.has(r.mealId) &&
      r.at <= asOf && Number.isInteger(r.score) && r.score >= 1 && r.score <= 5 &&
      parts.some(
        (p) =>
          p.userId === r.userId &&
          p.meal.id === r.mealId &&
          p.status === "present",
      )
    )
      feedbackMap.set(`${r.userId}:${r.mealId}`, r);
  const feedback = [...feedbackMap.values()];
  return {
    meals,
    parts,
    attendance: states,
    sourceDifferences: parts.filter((p) => sourceDifference(latestAttendance(data, p.userId, p.meal.id, asOf))).length,
    attendanceCoverage: {
      numerator: states.present + states.absent,
      denominator: parts.length,
    },
    weekly: [...weeks]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, users]) => ({ week, count: users.size })),
    attendedUsers: new Set(
      parts.filter((p) => p.status === "present").map((p) => p.userId),
    ).size,
    activation: {
      numerator: activation.filter((a) => a.converted).length,
      denominator: activation.length,
    },
    retention: {
      numerator: retention.reduce((s, c) => s + c.repeat, 0),
      denominator: retention.reduce((s, c) => s + c.mature, 0),
    },
    formation: {
      numerator: meals.filter((m) => m.peakConfirmed >= m.minimum).length,
      denominator: meals.length,
    },
    cancellations: {
      numerator: meals.filter((m) => m.cancelled).length,
      denominator: meals.length,
    },
    noResults: {
      numerator: discoveries.filter((e) => e.resultCount === 0).length,
      denominator: discoveries.length,
    },
    feedback,
    feedbackCoverage: {
      numerator: new Set(feedback.map((r) => `${r.userId}:${r.mealId}`)).size,
      denominator: states.present,
    },
    survey: productSurveys(data, f, asOf),
  };
}
export function funnel(data: Dataset, f: Filters, asOf = SNAPSHOT) {
  data = analyticalData(data);
  const events = filteredEvents(data, f, asOf);
  const identities = (es: Event[]) =>
    new Set(
      es.map((e) => e.userId || `anonymous:${e.anonymousId || e.sessionId}`),
    );
  const discoveries = events.filter((e) => e.name === "discovery_results"),
    exposed = events.filter(
      (e) =>
        e.name === "meal_impression" &&
        (e.durationMs || 0) >= 1000 &&
        (e.visibleRatio || 0) >= 0.5,
    ),
    details = events.filter((e) => e.name === "detail_view");
  const applications = data.applications.filter(
    (a) =>
      within(a.appliedAt, f) &&
      a.appliedAt <= asOf &&
      userMatches(data, a.userId, f) &&
      data.meals.some((m) => m.id === a.mealId && mealMatches(m, f)),
  );
  const approved = applications.filter(
      (a) => a.decision === "approved" && a.decidedAt && a.decidedAt <= asOf,
    ),
    confirmed = approved.filter((a) => a.confirmedAt && a.confirmedAt <= asOf);
  const completed = applications.filter((a) =>
    data.meals.some(
      (m) =>
        m.id === a.mealId && +new Date(m.endsAt || new Date(+new Date(m.startsAt) + 2 * 3_600_000).toISOString()) + DAY <= +new Date(asOf),
    ),
  );
  const present = completed.filter(
    (a) =>
      data.meals.some((m) => m.id === a.mealId && !m.cancelled) &&
      a.confirmedAt &&
      a.confirmedAt < data.meals.find((m) => m.id === a.mealId)!.startsAt &&
      (!a.withdrawnAt ||
        a.withdrawnAt > data.meals.find((m) => m.id === a.mealId)!.startsAt) &&
      attendance(latestAttendance(data, a.userId, a.mealId, asOf)) ===
        "present",
  );
  const discoveryUsers = identities(discoveries);
  const exposureCohort = exposed.filter(
    (e) => +new Date(e.occurredAt) + 7 * DAY <= +new Date(asOf),
  );
  const exposedMatureUsers = identities(exposureCohort);
  const exposedAppliedUsers = new Set(
    exposureCohort
      .filter((e) =>
        data.applications.some(
          (a) =>
            a.userId === e.userId &&
            a.appliedAt >= e.occurredAt &&
            +new Date(a.appliedAt) <= +new Date(e.occurredAt) + 7 * DAY &&
            a.appliedAt <= asOf &&
            data.meals.some((m) => m.id === a.mealId && mealMatches(m, f)),
        ),
      )
      .map((e) => e.userId || `anonymous:${e.anonymousId || e.sessionId}`),
  );
  const matured = new Set(
    discoveries
      .filter((e) => +new Date(e.occurredAt) + 7 * DAY <= +new Date(asOf))
      .map((e) => e.userId || `anonymous:${e.anonymousId || e.sessionId}`),
  );
  const appliedWithin7 = new Set<string>();
  for (const e of discoveries)
    if (+new Date(e.occurredAt) + 7 * DAY <= +new Date(asOf)) {
      if (
        data.applications.some(
          (a) =>
            a.userId === e.userId &&
            a.appliedAt >= e.occurredAt &&
            +new Date(a.appliedAt) <= +new Date(e.occurredAt) + 7 * DAY &&
            a.appliedAt <= asOf &&
            data.meals.some((m) => m.id === a.mealId && mealMatches(m, f)),
        )
      )
        appliedWithin7.add(e.userId!);
    }
  return {
    discovery: discoveryUsers.size,
    exposed: identities(exposed).size,
    details: identities(details).size,
    applications: applications.length,
    approved: approved.length,
    confirmed: confirmed.length,
    present: present.length,
    completed: completed.length,
    matureDiscovery: matured.size,
    appliedWithin7: appliedWithin7.size,
    exposedMatureUsers: exposedMatureUsers.size,
    exposedNoApplyUsers: exposedMatureUsers.size - exposedAppliedUsers.size,
    records: applications,
  };
}
export function createFunnel(data: Dataset, f: Filters, asOf = SNAPSHOT) {
  data = analyticalData(data);
  const starts = filteredEvents(data, f, asOf).filter(
    (e) => e.name === "create_started" && e.attemptId,
  );
  const all = cleanEvents(data.events, data.identityLinks, asOf).filter((e) => !e.userId || regularUser(data, e.userId));
  const identity = (e: Event) =>
    e.userId || `anonymous:${e.anonymousId || e.sessionId}`;
  const attempts = new Map<string, Event>();
  for (const e of starts.sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  )) {
    const key = `${identity(e)}:${e.attemptId}`;
    if (!attempts.has(key)) attempts.set(key, e);
  }
  let arranged = 0,
    published = 0;
  for (const start of attempts.values()) {
    const related = all.filter(
      (e) =>
        e.attemptId === start.attemptId &&
        identity(e) === identity(start) &&
        e.occurredAt >= start.occurredAt,
    );
    const arrangement = related
      .filter((e) => e.name === "create_arranged")
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
    if (!arrangement) continue;
    arranged++;
    if (
      related.some(
        (e) =>
          e.name === "meal_published" && e.occurredAt >= arrangement.occurredAt,
      )
    )
      published++;
  }
  return [attempts.size, arranged, published];
}
export function quantile(values: number[], q: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(q * sorted.length) - 1];
}
