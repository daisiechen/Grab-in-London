/** Canonical, in-memory R1 acceptance model. No authentication, storage or external delivery. */
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const PILOT_DEADLINES = {
  publish: 60,
  apply: 45,
  approve: 30,
  booking: 15,
} as const;
export const cutoffAt = (m: PilotMeal, kind: keyof typeof PILOT_DEADLINES) =>
  iso(+new Date(m.startsAt) - PILOT_DEADLINES[kind] * 60_000);
export type Value = "present" | "absent";
export type PilotUser = {
  id: string;
  name: string;
  bio: string;
  languages: string[];
  interests: string[];
  joinedAt: string;
  deleted?: boolean;
  adult?: boolean;
};
export type PilotMeal = {
  id: string;
  hostId: string;
  title: string;
  description: string;
  venue: string;
  address: string;
  area: string;
  mapUrl?: string;
  startsAt: string;
  scheduledEndAt: string;
  publishedAt: string;
  capacity: number;
  minimum: number;
  budgetMin: number;
  budgetMax: number;
  languages: string[];
  status: "OPEN" | "CANCELLED" | "COMPLETED";
  booking: "PENDING" | "DECLARED";
  declaration?: { at: string; count: number };
  checkpoint?: { at: string; passed: boolean; count: number };
  lowCountDecision?: "pending" | "continue";
  lowCountDecidedAt?: string;
  lowCountActual?: number;
  lowCountHistory?: {
    kind: "pending" | "continue" | "unresolved-at-start";
    at: string;
    count: number;
    sequence: number;
  }[];
  lowCountUnresolvedAtStart?: { at: string; count: number };
  cancelReasons?: string[];
  cancelledAt?: string;
  replacementFor?: string;
  version: number;
};
export type PilotApplication = {
  id: string;
  mealId: string;
  userId: string;
  message: string;
  appliedAt: string;
  state:
    | "PENDING"
    | "CONFIRMED"
    | "DECLINED"
    | "WITHDRAWN"
    | "EXPIRED"
    | "CANCELLED";
  decidedAt?: string;
  confirmedAt?: string;
  withdrawnAt?: string;
  confirmedSequence?: number;
  withdrawnSequence?: number;
  archivedMessages?: string[];
};
export type PilotAttendance = {
  mealId: string;
  userId: string;
  actorId: string;
  source: "self" | "host";
  value: Value;
  at: string;
  basis?: string;
  sequence: number;
};
export type PilotState = {
  version: number;
  now: string;
  users: PilotUser[];
  meals: PilotMeal[];
  applications: PilotApplication[];
  attendance: PilotAttendance[];
  feedback: {
    mealId: string;
    userId: string;
    score: number;
    again: boolean;
    reasons: string[];
    at: string;
  }[];
  reconnect: {
    mealId: string;
    from: string;
    to: string;
    wants: boolean;
    at: string;
  }[];
  blocks: { from: string; to: string }[];
  messages: {
    id: string;
    mealId?: string;
    from: string;
    toId?: string;
    sequence?: number;
    text: string;
    at: string;
  }[];
  reports: {
    id: string;
    actorId: string;
    subjectId: string;
    reason: string;
    status: "received";
    at: string;
  }[];
  notifications: {
    id: string;
    userId: string;
    mealId?: string;
    text: string;
    at: string;
    read?: boolean;
  }[];
  audit: {
    key: string;
    actor: string;
    type: string;
    at: string;
    version: number;
    fingerprint: string;
  }[];
};
export type Command = { type: string; key: string; [key: string]: unknown };
const iso = (n: number) => new Date(n).toISOString();
export const minimumFor = (capacity: number) => (capacity === 2 ? 2 : 3);
export function confirmedIds(s: PilotState, mealId: string, at = s.now) {
  const m = s.meals.find((m) => m.id === mealId);
  if (!m) return [];
  return [
    ...new Set([
      m.hostId,
      ...s.applications
        .filter(
          (a) =>
            a.mealId === mealId &&
            a.confirmedAt &&
            Date.parse(a.confirmedAt) <= Date.parse(at) &&
            (!a.withdrawnAt || Date.parse(a.withdrawnAt) > Date.parse(at)),
        )
        .map((a) => a.userId),
    ]),
  ];
}
export function eligibleAtMeal(s: PilotState, mealId: string, userId: string) {
  const m = s.meals.find((m) => m.id === mealId);
  if (!m || m.status === "CANCELLED") return false;
  return (
    m.hostId === userId ||
    s.applications.some(
      (a) =>
        a.mealId === mealId &&
        a.userId === userId &&
        a.confirmedAt &&
        Date.parse(a.confirmedAt) < Date.parse(m.startsAt) &&
        (!a.withdrawnAt || Date.parse(a.withdrawnAt) > Date.parse(m.startsAt)),
    )
  );
}
export function attendanceStatus(
  s: PilotState,
  mealId: string,
  userId: string,
): Value | "unknown" {
  const rows = s.attendance
    .filter(
      (a) =>
        a.mealId === mealId &&
        a.userId === userId &&
        Date.parse(a.at) <= Date.parse(s.now),
    )
    .sort((a, b) => a.sequence - b.sequence);
  const self = rows.filter((a) => a.source === "self").at(-1)?.value,
    host = rows.filter((a) => a.source === "host").at(-1)?.value;
  return self || host || "unknown";
}
export function canDirect(s: PilotState, from: string, to: string) {
  if (
    s.blocks.some(
      (b) =>
        (b.from === from && b.to === to) || (b.from === to && b.to === from),
    )
  )
    return false;
  if (s.users.some((u) => (u.id === from || u.id === to) && u.deleted))
    return false;
  return s.reconnect.some(
    (r) =>
      r.from === from &&
      r.to === to &&
      r.wants &&
      s.reconnect.some(
        (other) =>
          other.from === to &&
          other.to === from &&
          other.mealId === r.mealId &&
          other.wants,
      ) &&
      [from, to].every(
        (id) =>
          eligibleAtMeal(s, r.mealId, id) &&
          attendanceStatus(s, r.mealId, id) === "present",
      ),
  );
}
export function readableMessages(s: PilotState, mealId: string, actor: string) {
  const m = s.meals.find((m) => m.id === mealId);
  if (!m || s.users.find((u) => u.id === actor)?.deleted) return [];
  const intervals = s.applications.filter(
    (a) => a.mealId === mealId && a.userId === actor && a.confirmedAt,
  );
  return s.messages.filter(
    (msg) =>
      msg.mealId === mealId &&
      Date.parse(msg.at) <= Date.parse(s.now) &&
      (!m.cancelledAt || Date.parse(msg.at) <= Date.parse(m.cancelledAt)) &&
      (actor === m.hostId ||
        intervals.some(
          (a) =>
            (Date.parse(msg.at) > Date.parse(a.confirmedAt!) ||
              (Date.parse(msg.at) === Date.parse(a.confirmedAt!) &&
                (msg.sequence ?? 0) >= (a.confirmedSequence ?? 0))) &&
            (!a.withdrawnAt ||
              Date.parse(msg.at) < Date.parse(a.withdrawnAt) ||
              (Date.parse(msg.at) === Date.parse(a.withdrawnAt) &&
                (msg.sequence ?? 0) < (a.withdrawnSequence ?? 0))),
        )) &&
      !s.blocks.some((b) => b.from === actor && b.to === msg.from),
  );
}
export class PilotError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "VALIDATION", status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
function fail(message: string): never {
  const code = /Sign in/.test(message)
    ? "UNAUTHENTICATED"
    : /not found|unavailable/.test(message)
      ? "NOT_FOUND"
      : /Only|read-only|consent|membership/.test(message)
        ? "FORBIDDEN"
        : /version|Intent key|closed|locked|full/.test(message)
          ? "CONFLICT"
          : "VALIDATION";
  throw new PilotError(
    message,
    code,
    {
      UNAUTHENTICATED: 401,
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      CONFLICT: 409,
      VALIDATION: 422,
    }[code],
  );
}
/** Stable non-cryptographic intent comparison; never store application/chat/report text in the audit. */
function intentFingerprint(value: unknown): string {
  const stable = (v: unknown): string =>
    Array.isArray(v)
      ? "[" + v.map(stable).join(",") + "]"
      : v && typeof v === "object"
        ? "{" +
          Object.entries(v)
            .filter(([k]) => k !== "key")
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => JSON.stringify(k) + ":" + stable(v))
            .join(",") +
          "}"
        : (JSON.stringify(v) ?? "null");
  let h = 2166136261;
  for (const ch of stable(value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16);
}
/** Pure scheduler catch-up. Deadlines are evaluated at their own instant, once, even when delivery is late. */
export function advanceLifecycle(original: PilotState, at: string): PilotState {
  if (
    !Number.isFinite(Date.parse(at)) ||
    Date.parse(at) < Date.parse(original.now)
  )
    fail("The acceptance clock cannot move backwards.");
  const s = structuredClone(original);
  s.now = iso(Date.parse(at));
  for (const row of s.meals) {
    if (row.status !== "OPEN") continue;
    const approval = cutoffAt(row, "approve"),
      checkpoint = cutoffAt(row, "booking");
    for (const a of s.applications.filter(
      (a) =>
        a.mealId === row.id &&
        a.state === "PENDING" &&
        Date.parse(at) >= Date.parse(approval),
    )) {
      a.state = "EXPIRED";
      notify(
        s,
        [a.userId],
        row,
        "Application expired: the approval deadline passed.",
        approval,
      );
    }
    if (Date.parse(at) >= Date.parse(checkpoint) && !row.checkpoint) {
      const count = confirmedIds(s, row.id, checkpoint).length,
        reasons: string[] = [];
      if (count < row.minimum) reasons.push("insufficient");
      if (
        !row.declaration ||
        Date.parse(row.declaration.at) >= Date.parse(checkpoint) ||
        row.declaration.count !== count
      )
        reasons.push("booking");
      row.checkpoint = { at: checkpoint, passed: !reasons.length, count };
      if (reasons.length) cancel(s, row, reasons, checkpoint);
    }
    if (
      row.status === "OPEN" &&
      row.lowCountDecision === "pending" &&
      !row.lowCountUnresolvedAtStart &&
      Date.parse(at) >= Date.parse(row.startsAt)
    ) {
      const count = confirmedIds(s, row.id, row.startsAt).length;
      row.lowCountUnresolvedAtStart = { at: row.startsAt, count };
      (row.lowCountHistory ??= []).push({
        kind: "unresolved-at-start",
        at: row.startsAt,
        count,
        sequence: s.version + 1,
      });
      notify(
        s,
        confirmedIds(s, row.id, row.startsAt),
        row,
        "The meal has started without a recorded low-count decision. No host agreement is implied; the original minimum remains recorded.",
        row.startsAt,
      );
    }
    if (
      row.status === "OPEN" &&
      Date.parse(at) >= Date.parse(row.scheduledEndAt)
    )
      row.status = "COMPLETED";
  }
  return s;
}
function member(s: PilotState, id: string) {
  return (
    s.users.find((u) => u.id === id && !u.deleted) ||
    fail("Sign in again to continue.")
  );
}
function meal(s: PilotState, id: string) {
  return s.meals.find((m) => m.id === id) || fail("This meal is unavailable.");
}
function notify(
  s: PilotState,
  users: string[],
  m: PilotMeal,
  text: string,
  at: string,
) {
  for (const userId of [...new Set(users)])
    s.notifications.push({
      id: `n-${s.notifications.length + 1}`,
      userId,
      mealId: m.id,
      text,
      at,
    });
}
function cancel(s: PilotState, m: PilotMeal, reasons: string[], at: string) {
  if (m.status === "CANCELLED") return;
  const affected = [
    m.hostId,
    ...s.applications
      .filter(
        (a) => a.mealId === m.id && ["PENDING", "CONFIRMED"].includes(a.state),
      )
      .map((a) => a.userId),
  ];
  m.status = "CANCELLED";
  m.cancelReasons = reasons;
  m.cancelledAt = at;
  m.version++;
  for (const a of s.applications.filter((a) => a.mealId === m.id)) {
    if (a.state === "PENDING") a.state = "EXPIRED";
    if (a.state === "CONFIRMED")
      a.archivedMessages = readableMessages(s, m.id, a.userId).map((m) => m.id);
  }
  notify(
    s,
    affected,
    m,
    `Meal cancelled: ${reasons.join(", ")}. No payment was taken.`,
    at,
  );
}
function requestLowCountDecision(s: PilotState, row: PilotMeal, at: string) {
  if (Date.parse(at) >= Date.parse(row.startsAt)) return;
  row.lowCountDecision = "pending";
  delete row.lowCountDecidedAt;
  delete row.lowCountActual;
  const count = confirmedIds(s, row.id).length;
  (row.lowCountHistory ??= []).push({
    kind: "pending",
    at,
    count,
    sequence: s.version + 1,
  });
  notify(
    s,
    confirmedIds(s, row.id),
    row,
    "Guest count fell below the minimum. The host must choose to continue or cancel before the start.",
    at,
  );
}
export function act(
  original: PilotState,
  actor: string,
  c: Command,
  at: string,
  expectedVersion = original.version,
): PilotState {
  if (!c.key || !Number.isFinite(Date.parse(at)))
    fail("Invalid command or time.");
  if (actor === "system" && c.type !== "tick")
    fail("Only lifecycle commands are allowed for the scheduler.");
  if (actor !== "system") member(original, actor);
  const fingerprint = intentFingerprint(c);
  const prior = original.audit.find(
    (a) => a.key === c.key && a.actor === actor,
  );
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      fail("Intent key was already used for a different request.");
    return original;
  }
  if (original.version !== expectedVersion)
    fail("State version changed. Reload and review before retrying.");
  if (Date.parse(at) < Date.parse(original.now))
    fail("The acceptance clock cannot move backwards.");
  const s = advanceLifecycle(original, at);
  at = s.now;
  if (actor !== "system") member(s, actor);
  const m = c.mealId ? meal(s, String(c.mealId)) : undefined;
  const required = () => m || fail("Select a meal.");
  const host = () => {
    const row = required();
    if (row.hostId !== actor) fail("Only this meal’s host may do that.");
    return row;
  };
  const open = () => {
    const row = required();
    if (row.status !== "OPEN" || Date.parse(at) >= Date.parse(row.startsAt))
      fail("This meal is closed.");
    return row;
  };
  const window = (id = actor) => {
    const row = required();
    if (
      !eligibleAtMeal(s, row.id, id) ||
      Date.parse(at) < Date.parse(row.scheduledEndAt) ||
      +new Date(at) >= +new Date(row.scheduledEndAt) + 7 * DAY
    )
      fail("The post-meal window is closed or this participant is ineligible.");
    return row;
  };
  switch (c.type) {
    case "tick": {
      if (actor !== "system") fail("Only the scheduler may advance lifecycle.");
      break;
    }
    case "apply": {
      if (member(s, actor).adult !== true)
        fail("Confirm you are 18 or older before applying or hosting.");
      const row = open();
      if (+new Date(at) >= +new Date(cutoffAt(row, "apply")))
        fail("Applications are closed.");
      if (row.hostId === actor) fail("You host this meal.");
      if (confirmedIds(s, row.id).length >= row.capacity)
        fail("This table is full.");
      const previous = s.applications
        .filter((a) => a.mealId === row.id && a.userId === actor)
        .at(-1);
      if (previous && !["WITHDRAWN", "CANCELLED"].includes(previous.state))
        fail("You cannot apply again to this meal.");
      const message = String(c.message || "").trim();
      if (message.length < 20 || message.length > 300)
        fail("Write an introduction of 20–300 characters.");
      const u = member(s, actor);
      if (
        u.name.trim().length < 2 ||
        u.name.length > 40 ||
        u.bio.length > 1000 ||
        u.bio.trim().length < 20 ||
        !u.languages.length ||
        !u.interests.length
      )
        fail("Complete your profile first.");
      s.applications.push({
        id: `a-${s.version + 1}`,
        mealId: row.id,
        userId: actor,
        message,
        appliedAt: at,
        state: "PENDING",
      });
      notify(s, [row.hostId], row, "A new application is ready to review.", at);
      break;
    }
    case "approve":
    case "decline":
    case "withdraw": {
      const a =
        s.applications.find((a) => a.id === c.applicationId) ||
        fail("Application not found.");
      const row = meal(s, a.mealId);
      if (
        row.status !== "OPEN" ||
        Date.parse(at) >= Date.parse(cutoffAt(row, "approve"))
      )
        fail("Approvals are closed.");
      if (a.state !== "PENDING")
        fail("Only a pending application can be changed.");
      if (c.type === "withdraw") {
        if (a.userId !== actor)
          fail("Only your own application may be withdrawn.");
        a.state = "WITHDRAWN";
        a.withdrawnAt = at;
        a.withdrawnSequence = s.version + 1;
        notify(
          s,
          [row.hostId],
          row,
          "An applicant withdrew their request.",
          at,
        );
        break;
      }
      if (row.hostId !== actor) fail("Only this host can review applications.");
      if (
        row.status !== "OPEN" ||
        +new Date(at) >= +new Date(cutoffAt(row, "approve"))
      )
        fail("Approvals are closed.");
      if (
        c.type === "approve" &&
        confirmedIds(s, row.id).length >= row.capacity
      )
        fail("This table is full.");
      a.state = c.type === "approve" ? "CONFIRMED" : "DECLINED";
      a.decidedAt = at;
      if (c.type === "approve") {
        a.confirmedAt = at;
        a.confirmedSequence = s.version + 1;
        row.version++;
      }
      notify(
        s,
        [a.userId],
        row,
        c.type === "approve"
          ? "Your seat is confirmed. Pay at the restaurant; your group chat is open."
          : "Your application was declined.",
        at,
      );
      break;
    }
    case "declare": {
      const row = host();
      open();
      if (+new Date(at) >= +new Date(cutoffAt(row, "booking")))
        fail("Booking declarations are closed.");
      row.booking = "DECLARED";
      row.declaration = { at, count: confirmedIds(s, row.id).length };
      row.version++;
      notify(
        s,
        confirmedIds(s, row.id),
        row,
        "The host has declared an external reservation.",
        at,
      );
      break;
    }
    case "cancel": {
      const row = host();
      if (
        row.status === "COMPLETED" ||
        Date.parse(at) >= Date.parse(row.startsAt)
      )
        fail("A started meal cannot be cancelled retrospectively.");
      if (
        typeof c.reason !== "string" ||
        !["host", "host_changed", "other"].includes(c.reason)
      )
        fail("Choose a cancellation reason code: host, host_changed or other.");
      cancel(s, row, [c.reason], at);
      break;
    }
    case "leave": {
      const row = open();
      if (row.hostId === actor) fail("Hosts must cancel the whole meal.");
      const a =
        s.applications.find(
          (a) =>
            a.mealId === row.id &&
            a.userId === actor &&
            a.state === "CONFIRMED",
        ) || fail("A confirmed membership is required.");
      a.archivedMessages = readableMessages(s, row.id, actor).map((m) => m.id);
      a.state = "CANCELLED";
      a.withdrawnAt = at;
      a.withdrawnSequence = s.version + 1;
      row.version++;
      if (
        row.checkpoint?.passed &&
        confirmedIds(s, row.id).length < row.minimum
      ) {
        requestLowCountDecision(s, row, at);
      } else
        notify(
          s,
          [row.hostId],
          row,
          "A guest left. Review your reservation headcount.",
          at,
        );
      break;
    }
    case "continue": {
      const row = host();
      open();
      if (!row.checkpoint?.passed || row.lowCountDecision !== "pending")
        fail("No low-count decision is pending.");
      row.lowCountDecision = "continue";
      row.lowCountDecidedAt = at;
      row.lowCountActual = confirmedIds(s, row.id).length;
      (row.lowCountHistory ??= []).push({
        kind: "continue",
        at,
        count: row.lowCountActual,
        sequence: s.version + 1,
      });
      row.version++;
      notify(
        s,
        confirmedIds(s, row.id),
        row,
        "The host chose to continue with fewer guests and will contact the restaurant.",
        at,
      );
      break;
    }
    case "edit": {
      const row = host();
      open();
      const critical = [
        "venue",
        "address",
        "area",
        "startsAt",
        "budgetMin",
        "budgetMax",
        "capacity",
        "languages",
        "mapUrl",
      ];
      if (critical.some((k) => c[k] !== undefined)) {
        if (s.applications.some((a) => a.mealId === row.id && a.confirmedAt))
          fail(
            "Confirmed arrangements are locked. Cancel and publish a replacement.",
          );
        const changed = {
          ...row,
          ...Object.fromEntries(
            critical.filter((k) => c[k] !== undefined).map((k) => [k, c[k]]),
          ),
        };
        const validated = act(
          s,
          actor,
          { type: "publish", key: c.key + "-validation", meal: changed },
          at,
        ).meals.at(-1)!;
        Object.assign(
          row,
          Object.fromEntries(
            critical.map((k) => [k, validated[k as keyof PilotMeal]]),
          ),
          {
            minimum: validated.minimum,
            scheduledEndAt: validated.scheduledEndAt,
            booking: "PENDING",
            declaration: undefined,
          },
        );
      }
      if (c.title !== undefined) {
        const title = String(c.title).trim();
        if (title.length < 5 || title.length > 80)
          fail("Title must contain 5–80 characters.");
        row.title = title;
      }
      if (c.description !== undefined) {
        const text = String(c.description).trim();
        if (text.length < 20 || text.length > 1000)
          fail("Description must contain 20–1000 characters.");
        row.description = text;
      }
      row.version++;
      break;
    }
    case "publish": {
      if (member(s, actor).adult !== true)
        fail("Confirm you are 18 or older before applying or hosting.");
      const input = (c.meal as Partial<PilotMeal>) || {};
      const title = String(input.title || "").trim(),
        description = String(input.description || "").trim();
      if (
        title.length < 5 ||
        title.length > 80 ||
        description.length < 20 ||
        description.length > 1000
      )
        fail("Add a title (5–80) and introduction (20–1000 characters).");
      if (
        !input.startsAt ||
        !Number.isFinite(Date.parse(input.startsAt)) ||
        +new Date(input.startsAt) - +new Date(at) < HOUR
      )
        fail("Publish at least 60 minutes before the meal.");
      if (
        !Number.isInteger(input.capacity) ||
        input.capacity! < 2 ||
        input.capacity! > 6
      )
        fail("Choose 2–6 people, including you.");
      if (
        typeof input.venue !== "string" ||
        typeof input.address !== "string" ||
        typeof input.area !== "string" ||
        !input.venue.trim() ||
        !input.address.trim() ||
        !input.area.trim() ||
        input.venue.length > 100 ||
        input.address.length > 200 ||
        input.area.length > 80
      )
        fail("Add the restaurant name, address and area.");
      if (
        input.mapUrl &&
        !/^https:\/\/(www\.)?google\.[^/]+\/maps/.test(input.mapUrl)
      )
        fail("Use a valid HTTPS Google Maps link.");
      if (
        !Number.isInteger(input.budgetMin) ||
        !Number.isInteger(input.budgetMax) ||
        input.budgetMin! <= 0 ||
        input.budgetMax! < input.budgetMin!
      )
        fail("Enter a positive budget range in whole pence.");
      if (
        !Array.isArray(input.languages) ||
        !input.languages.length ||
        input.languages.some(
          (l) =>
            ![
              "en",
              "zh",
              "fr",
              "es",
              "de",
              "it",
              "ja",
              "ko",
              "ar",
              "pt",
              "hi",
            ].includes(l),
        )
      )
        fail("Choose at least one language.");
      if (input.replacementFor) {
        const old = meal(s, input.replacementFor);
        if (old.hostId !== actor || old.status !== "CANCELLED")
          fail(
            "Cancel your own original meal before publishing a replacement.",
          );
      }
      s.meals.push({
        id: `meal-${s.version + 1}`,
        hostId: actor,
        title,
        description,
        venue: input.venue.trim(),
        address: input.address.trim(),
        area: input.area.trim(),
        capacity: input.capacity!,
        minimum: minimumFor(input.capacity!),
        budgetMin: input.budgetMin!,
        budgetMax: input.budgetMax!,
        languages: input.languages,
        mapUrl: input.mapUrl,
        startsAt: iso(Date.parse(input.startsAt)),
        scheduledEndAt: iso(+new Date(input.startsAt) + 2 * HOUR),
        publishedAt: at,
        status: "OPEN",
        booking: "PENDING",
        version: 1,
        replacementFor: input.replacementFor,
      });
      break;
    }
    case "send": {
      const row = required();
      if (
        row.status !== "OPEN" ||
        Date.parse(at) >= Date.parse(row.scheduledEndAt) ||
        !confirmedIds(s, row.id).includes(actor)
      )
        fail("Your group is read-only. Confirmed membership is required.");
      const text = String(c.text || "").trim();
      if (!text || text.length > 2000) fail("Write 1–2000 characters.");
      s.messages.push({
        id: `msg-${s.version + 1}`,
        mealId: row.id,
        from: actor,
        sequence: s.version + 1,
        text,
        at,
      });
      notify(
        s,
        confirmedIds(s, row.id).filter((id) => id !== actor),
        row,
        "Your table has a new message.",
        at,
      );
      break;
    }
    case "attendance": {
      const id = String(c.userId);
      const row = window(id);
      if (actor !== id && actor !== row.hostId)
        fail("Only the participant or this host can report.");
      if (
        actor !== id &&
        s.attendance.some(
          (a) => a.mealId === row.id && a.userId === id && a.source === "self",
        )
      )
        fail(
          "The participant has already reported. Hosts only supplement missing reports.",
        );
      if (c.value !== "present" && c.value !== "absent")
        fail("Choose attended or did not attend.");
      s.attendance.push({
        mealId: row.id,
        userId: id,
        actorId: actor,
        source: actor === id ? "self" : "host",
        value: c.value,
        at,
        basis: c.basis ? String(c.basis) : undefined,
        sequence: s.version + 1,
      });
      break;
    }
    case "feedback": {
      const row = window();
      const status = attendanceStatus(s, row.id, actor);
      if (status !== "present")
        fail("Record attendance before giving private feedback.");
      const reasons = c.reasons as string[];
      if (
        !Number.isInteger(c.score) ||
        Number(c.score) < 1 ||
        Number(c.score) > 5 ||
        typeof c.again !== "boolean" ||
        !Array.isArray(reasons) ||
        reasons.some(
          (r) =>
            ![
              "company",
              "conversation",
              "coordination",
              "expectations",
              "venue",
              "cost",
              "other",
            ].includes(r),
        )
      )
        fail("Choose a rating and whether you would join another meal.");
      s.feedback = s.feedback.filter(
        (f) => !(f.mealId === row.id && f.userId === actor),
      );
      s.feedback.push({
        mealId: row.id,
        userId: actor,
        score: Number(c.score),
        again: c.again,
        reasons: [...new Set(reasons)],
        at,
      });
      break;
    }
    case "reconnect": {
      if (typeof c.wants !== "boolean") fail("Choose whether to reconnect.");
      const row = c.wants ? window() : required();
      if (c.wants && attendanceStatus(s, row.id, actor) !== "present")
        fail("Record attendance before reconnecting.");
      const to = String(c.userId);
      if (to === actor || !s.users.some((u) => u.id === to))
        fail("Choose another participant.");
      if (c.wants) {
        member(s, to);
        if (!eligibleAtMeal(s, row.id, to))
          fail("Choose another eligible participant.");
      } else {
        // Retraction targets the person, not just the meal used as the UI entry.
        // Preserve their independent consent, but no other shared meal may keep this pair writable.
        s.reconnect = s.reconnect.map((r) =>
          r.from === actor && r.to === to ? { ...r, wants: false, at } : r,
        );
      }
      s.reconnect = s.reconnect.filter(
        (r) => !(r.from === actor && r.to === to && r.mealId === row.id),
      );
      s.reconnect.push({
        mealId: row.id,
        from: actor,
        to,
        wants: !!c.wants,
        at,
      });
      break;
    }
    case "block": {
      const to = String(c.userId);
      member(s, to);
      if (to === actor) fail("You cannot block yourself.");
      s.blocks = s.blocks.filter((b) => !(b.from === actor && b.to === to));
      if (typeof c.blocked !== "boolean") fail("Choose block or unblock.");
      if (c.blocked) {
        s.blocks.push({ from: actor, to });
        s.reconnect = s.reconnect.map((r) =>
          (r.from === actor && r.to === to) || (r.from === to && r.to === actor)
            ? { ...r, wants: false }
            : r,
        );
      }
      break;
    }
    case "direct": {
      const to = String(c.userId);
      if (!canDirect(s, actor, to))
        fail(
          "Both people must consent, have valid attendance and be unblocked.",
        );
      const text = String(c.text || "").trim();
      if (!text || text.length > 2000) fail("Write 1–2000 characters.");
      s.messages.push({
        id: `msg-${s.version + 1}`,
        from: actor,
        sequence: s.version + 1,
        toId: to,
        text,
        at,
      });
      break;
    }
    case "report": {
      const to = String(c.userId);
      member(s, to);
      if (to === actor) fail("Choose another member.");
      const reason = String(c.reason || "").trim();
      if (reason.length < 5 || reason.length > 1000)
        fail("Describe your concern in 5–1000 characters.");
      s.reports.push({
        id: `report-${s.version + 1}`,
        actorId: actor,
        subjectId: to,
        reason,
        status: "received",
        at,
      });
      break;
    }
    case "profile": {
      const u = member(s, actor),
        name = String(c.name || "").trim(),
        bio = String(c.bio || "").trim();
      const languages = c.languages as string[],
        interests = c.interests as string[];
      if (
        name.length < 2 ||
        name.length > 40 ||
        bio.length < 20 ||
        bio.length > 1000 ||
        !Array.isArray(languages) ||
        !languages.length ||
        languages.some(
          (l) =>
            ![
              "en",
              "zh",
              "fr",
              "es",
              "de",
              "it",
              "ja",
              "ko",
              "ar",
              "pt",
              "hi",
            ].includes(l),
        ) ||
        !Array.isArray(interests) ||
        !interests.length ||
        interests.some((i) => typeof i !== "string" || i.length > 40)
      )
        fail(
          "Add a name (2–40), introduction (20–1000), language and interest.",
        );
      u.name = name;
      u.bio = bio;
      u.languages = languages;
      u.interests = interests;
      break;
    }
    case "delete-account": {
      if (c.confirmation !== "DELETE" || c.reauthenticated !== true)
        fail("Reauthenticate and type DELETE to confirm account deletion.");
      const u = member(s, actor);
      for (const row of s.meals.filter(
        (m) =>
          m.hostId === actor &&
          m.status === "OPEN" &&
          Date.parse(at) < Date.parse(m.startsAt),
      ))
        cancel(s, row, ["account-deleted"], at);
      for (const a of s.applications.filter((a) => a.userId === actor)) {
        a.message = "";
        if (a.state === "PENDING") {
          a.state = "WITHDRAWN";
          a.withdrawnAt = at;
          a.withdrawnSequence = s.version + 1;
        }
        if (
          a.state === "CONFIRMED" &&
          meal(s, a.mealId).status === "OPEN" &&
          Date.parse(at) < Date.parse(meal(s, a.mealId).startsAt)
        ) {
          a.state = "CANCELLED";
          a.withdrawnAt = at;
          a.withdrawnSequence = s.version + 1;
          const row = meal(s, a.mealId);
          if (
            row.checkpoint?.passed &&
            confirmedIds(s, row.id).length < row.minimum
          )
            requestLowCountDecision(s, row, at);
          notify(
            s,
            [row.hostId],
            row,
            "A guest left. Review the reservation headcount.",
            at,
          );
        }
      }
      u.deleted = true;
      u.name = "Deleted member";
      u.bio = "";
      u.languages = [];
      u.interests = [];
      s.messages = s.messages.map((m) =>
        m.from === actor ? { ...m, text: "[Deleted message]" } : m,
      );
      s.reports = s.reports.map((r) =>
        r.actorId === actor
          ? { ...r, reason: "[Deleted personal content]" }
          : r,
      );
      s.feedback = s.feedback.filter((f) => f.userId !== actor);
      s.notifications = s.notifications.filter((n) => n.userId !== actor);
      s.reconnect = s.reconnect.map((r) =>
        r.from === actor || r.to === actor ? { ...r, wants: false } : r,
      );
      break;
    }
    case "read-notification": {
      const n =
        s.notifications.find(
          (n) => n.id === c.notificationId && n.userId === actor,
        ) || fail("Notification not found.");
      n.read = true;
      break;
    }
    default:
      fail("Unknown command.");
  }
  s.version++;
  s.audit.push({
    key: c.key,
    actor,
    type: c.type,
    at,
    version: s.version,
    fingerprint,
  });
  return s;
}
export function pilotSeed(): PilotState {
  const now = "2026-10-19T12:00:00.000Z";
  const users = ["alex", "maya", "leo", "emma", "operator"].map((id) => ({
    id,
    name: id[0].toUpperCase() + id.slice(1),
    bio: "I enjoy good food, easy conversation and meeting new people in London.",
    languages: ["en"],
    interests: ["Food"],
    adult: true,
    joinedAt: "2026-09-01T12:00:00.000Z",
  }));
  const base: PilotMeal = {
    id: "supper",
    hostId: "maya",
    title: "An easy Friday supper",
    description:
      "A relaxed Friday dinner with new London friends. Sharing plates, easy conversation and no agenda.",
    venue: "The Little Table",
    address: "Fictional restaurant · Soho, London",
    area: "Soho",
    startsAt: "2026-10-23T18:00:00.000Z",
    scheduledEndAt: "2026-10-23T20:00:00.000Z",
    publishedAt: "2026-10-17T12:00:00.000Z",
    capacity: 4,
    minimum: 3,
    budgetMin: 2500,
    budgetMax: 3500,
    languages: ["en"],
    status: "OPEN",
    booking: "PENDING",
    version: 1,
  };
  const meals = [
    base,
    {
      ...base,
      id: "duo",
      title: "Lunch with someone new",
      venue: "The Garden Kitchen",
      address: "Fictional restaurant · St James’s, London",
      area: "St James’s",
      startsAt: "2026-10-24T11:30:00.000Z",
      scheduledEndAt: "2026-10-24T13:30:00.000Z",
      capacity: 2,
      minimum: 2,
    },
    {
      ...base,
      id: "hosting",
      hostId: "alex",
      title: "A table for new friends",
      capacity: 4,
      startsAt: "2026-10-24T18:00:00.000Z",
      scheduledEndAt: "2026-10-24T20:00:00.000Z",
    },
    {
      ...base,
      id: "past",
      title: "A Sunday table",
      startsAt: "2026-10-18T11:00:00.000Z",
      scheduledEndAt: "2026-10-18T13:00:00.000Z",
      publishedAt: "2026-10-15T12:00:00.000Z",
      status: "COMPLETED" as const,
      booking: "DECLARED" as const,
    },
  ];
  const applications: PilotApplication[] = [
    ["supper", "leo"],
    ["supper", "emma"],
    ["hosting", "emma"],
    ["hosting", "leo"],
    ["past", "alex"],
    ["past", "emma"],
  ].map(([mealId, userId], i) => ({
    id: `seed-${i}`,
    mealId,
    userId,
    message: "Looking forward to sharing a meal together.",
    appliedAt:
      mealId === "past"
        ? "2026-10-16T12:00:00.000Z"
        : "2026-10-17T13:00:00.000Z",
    state: "CONFIRMED",
    decidedAt:
      mealId === "past"
        ? "2026-10-16T13:00:00.000Z"
        : "2026-10-17T14:00:00.000Z",
    confirmedAt:
      mealId === "past"
        ? "2026-10-16T13:00:00.000Z"
        : "2026-10-17T14:00:00.000Z",
  }));
  return {
    version: 0,
    now,
    users,
    meals,
    applications,
    attendance: ["alex", "maya", "emma"].map((userId, i) => ({
      mealId: "past",
      userId,
      actorId: userId,
      source: "self" as const,
      value: "present" as const,
      at: "2026-10-18T14:00:00.000Z",
      sequence: i,
    })),
    feedback: [],
    reconnect: [],
    blocks: [],
    messages: [],
    reports: [],
    notifications: [],
    audit: [],
  };
}
/** Sanitized demo handoff only. Names, bios, chat, report text and unilateral choices never enter analytics. */
const reasonCode = (reason: string) =>
  [
    "insufficient",
    "booking",
    "host",
    "host_changed",
    "other",
    "unknown",
  ].includes(reason)
    ? reason
    : "other";
export function projectAnalytics(s: PilotState) {
  return {
    contractVersion: "r1-1",
    demo: true,
    asOf: s.now,
    users: s.users
      .filter((u) => u.id !== "operator")
      .map((u) => ({ id: u.id, joinedAt: u.joinedAt })),
    meals: s.meals.map((m) => ({
      id: m.id,
      title: "Meal " + m.id,
      hostId: m.hostId,
      startsAt: m.startsAt,
      endsAt: m.scheduledEndAt,
      publishedAt: m.publishedAt,
      area: m.area,
      language: m.languages
        .map(
          (l) =>
            ({ en: "English", zh: "Chinese", es: "Spanish", fr: "French" })[
              l
            ] || l,
        )
        .join(" & "),
      capacity: m.capacity,
      minimum: m.minimum,
      budget: m.budgetMax / 100,
      source: "user" as const,
      cancelled: m.status === "CANCELLED",
      cancelledAt: m.cancelledAt,
      cancelReason: m.cancelReasons?.map(reasonCode)[0],
      cancelReasons: m.cancelReasons?.map(reasonCode),
      peakConfirmed: Math.max(
        1,
        ...[
          m.publishedAt,
          ...s.applications
            .filter((a) => a.mealId === m.id && a.confirmedAt)
            .map((a) => a.confirmedAt!),
        ]
          .filter((at) => at < m.startsAt)
          .map((at) => confirmedIds(s, m.id, at).length),
      ),
      checkpoint: m.checkpoint,
      lowCountDecision: m.lowCountDecision,
    })),
    applications: s.applications.map(
      ({
        message,
        archivedMessages,
        confirmedSequence,
        withdrawnSequence,
        state,
        ...a
      }) => ({
        ...a,
        decision: a.decidedAt
          ? state === "DECLINED"
            ? ("declined" as const)
            : ("approved" as const)
          : undefined,
        expired: state === "EXPIRED",
      }),
    ),
    attendance: s.meals.flatMap((m) =>
      s.users
        .filter((u) => eligibleAtMeal(s, m.id, u.id))
        .map((u) => {
          const rows = s.attendance
            .filter(
              (a) =>
                a.mealId === m.id &&
                a.userId === u.id &&
                Date.parse(a.at) <= Date.parse(s.now),
            )
            .sort((a, b) => a.sequence - b.sequence);
          return {
            mealId: m.id,
            userId: u.id,
            self: rows.filter((a) => a.source === "self").at(-1)?.value,
            host: rows.filter((a) => a.source === "host").at(-1)?.value,
            updatedAt: rows.at(-1)?.at || s.now,
          };
        }),
    ),
    feedback: s.feedback
      .filter(
        (f) =>
          eligibleAtMeal(s, f.mealId, f.userId) &&
          attendanceStatus(s, f.mealId, f.userId) === "present",
      )
      .map((f) => ({ ...f, issue: "none" as const })),
    events: [],
  };
}

/** Server-side field projection contract. Never return the state graph to clients. */
export function projectMember(
  s: PilotState,
  actor: string | null,
  target: string,
) {
  const u = s.users.find((u) => u.id === target);
  if (!u || u.deleted) return { id: target, name: "Deleted member" };
  if (!actor) return { id: u.id, name: u.name };
  member(s, actor);
  if (
    s.blocks.some(
      (b) =>
        (b.from === actor && b.to === target) ||
        (b.from === target && b.to === actor),
    )
  )
    return { id: u.id, name: "Member unavailable" };
  return {
    id: u.id,
    name: u.name,
    bio: u.bio,
    languages: u.languages,
    interests: u.interests,
  };
}
export function exportAccount(s: PilotState, actor: string) {
  const profile = member(s, actor);
  return {
    asOf: s.now,
    profile,
    applications: s.applications.filter((a) => a.userId === actor),
    attendance: s.attendance.filter((a) => a.userId === actor),
    feedback: s.feedback.filter((f) => f.userId === actor),
    reconnect: s.reconnect.filter((r) => r.from === actor),
    messages: s.messages.filter((m) => m.from === actor),
    reports: s.reports.filter((r) => r.actorId === actor),
  };
}
export function groupAccess(s: PilotState, mealId: string, actor: string) {
  const m = s.meals.find((m) => m.id === mealId);
  if (!m || s.users.find((u) => u.id === actor)?.deleted) return "none";
  const ever =
    m.hostId === actor ||
    s.applications.some(
      (a) => a.mealId === mealId && a.userId === actor && a.confirmedAt,
    );
  if (!ever) return "none";
  return m.status === "OPEN" && confirmedIds(s, mealId).includes(actor)
    ? "write"
    : "read";
}
/** Resolve London wall time without the browser's timezone. A repeated DST hour requires an explicit offset choice. */
export function londonInstants(date: string, time: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    return [];
  const guess = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(guess)) return [];
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return [-HOUR, 0, HOUR]
    .map((offset) => iso(guess + offset))
    .filter((value) => {
      const parts = Object.fromEntries(
        fmt.formatToParts(new Date(value)).map((p) => [p.type, p.value]),
      );
      return (
        `${parts.year}-${parts.month}-${parts.day}` === date &&
        `${parts.hour}:${parts.minute}` === time
      );
    });
}
