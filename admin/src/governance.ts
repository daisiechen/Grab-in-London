import type { AccountType, Dataset } from "./analytics.ts";
import { SNAPSHOT } from "./analytics.ts";

// R1 admin access: reuse product login, then allow only founder accounts on a server-side allowlist.
// The demo switch below only illustrates the gate; production must authorise every request on the server.
export type Actor = { id: string; allowlisted: boolean };
export type Action =
  | "view_aggregates"
  | "view_records"
  | "export_aggregates"
  | "classify_account"
  | "handle_report"
  | "view_audit"
  | "rebuild_snapshot";
export const actions: Action[] = [
  "view_aggregates",
  "view_records",
  "export_aggregates",
  "classify_account",
  "handle_report",
  "view_audit",
  "rebuild_snapshot",
];
export const can = (actor: Actor, _action: Action) => actor.allowlisted;
export const founder: Actor = { id: "founder-demo", allowlisted: true };
export const outsider: Actor = { id: "member-demo", allowlisted: false };

export class GovernanceError extends Error {
  code: "forbidden" | "version_conflict" | "invalid";
  constructor(
    code: "forbidden" | "version_conflict" | "invalid",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}
export type ReportStatus = "received" | "in_progress" | "resolved";
// Minimal on-demand case record. No routine moderation queue, SLA or staff roster.
export type ReportCase = {
  id: string;
  subjectId: string;
  mealId?: string;
  reason: string;
  receivedAt: string;
  status: ReportStatus;
  basis?: string;
  version: number;
};
export type AuditEntry = {
  id: string;
  version: number;
  action: "classify_account" | "handle_report" | "import_handoff";
  actorId: string;
  at: string;
  subject: string;
  from?: string;
  to: string;
  reason: string;
};
export type FactStore = {
  data: Dataset;
  asOf: string;
  version: number;
  accountVersions: Record<string, number>;
  reports: ReportCase[];
  audit: AuditEntry[];
};
export type Snapshot = {
  id: string;
  sequence: number;
  asOf: string;
  definitionVersion: "r1-v3";
  factVersion: number;
  source: "fixture" | "handoff";
  data: Dataset;
  sourceStatus: { events: "available" | "not_connected"; business: "fixture" | "handoff" };
};
export const REASON_MAX = 200;

export function createStore(
  data: Dataset,
  reports: ReportCase[] = [],
  asOf = SNAPSHOT,
): FactStore {
  return { data: structuredClone(data), asOf, version: 0, accountVersions: {}, reports: structuredClone(reports), audit: [] };
}
export const accountVersion = (store: FactStore, userId: string) =>
  store.accountVersions[userId] ?? 0;

function requireText(text: string) {
  const value = text.trim();
  if (!value || value.length > REASON_MAX)
    throw new GovernanceError("invalid", "reason");
  return value;
}
function guard(actor: Actor, action: Action) {
  if (!can(actor, action)) throw new GovernanceError("forbidden", action);
}
function append(
  store: FactStore,
  next: Partial<FactStore>,
  entry: Omit<AuditEntry, "id" | "version">,
): FactStore {
  const version = store.version + 1;
  return {
    ...store,
    ...next,
    version,
    audit: [...store.audit, { ...entry, id: `AUD-${version}`, version }],
  };
}

// The frozen demo clock stamps writes at the store cutoff; ordering comes from version.
export function classifyAccount(
  store: FactStore,
  actor: Actor,
  input: { userId: string; to: AccountType; reason: string; expectedVersion: number },
): FactStore {
  guard(actor, "classify_account");
  const user = store.data.users.find((u) => u.id === input.userId);
  if (!user) throw new GovernanceError("invalid", "user");
  if (!["regular", "test", "staff"].includes(input.to)) throw new GovernanceError("invalid", "classification");
  const reason = requireText(input.reason);
  const current = accountVersion(store, user.id);
  if (input.expectedVersion !== current)
    throw new GovernanceError("version_conflict", String(current));
  const from = user.accountType || "regular";
  if (from === input.to) throw new GovernanceError("invalid", "unchanged");
  return append(
    store,
    {
      data: {
        ...store.data,
        users: store.data.users.map((u) =>
          u.id === user.id ? { ...u, accountType: input.to } : u,
        ),
      },
      accountVersions: { ...store.accountVersions, [user.id]: current + 1 },
    },
    { action: "classify_account", actorId: actor.id, at: store.asOf, subject: user.id, from, to: input.to, reason },
  );
}

const nextStatus: Record<ReportStatus, ReportStatus | undefined> = {
  received: "in_progress",
  in_progress: "resolved",
  resolved: undefined,
};
export function advanceReport(
  store: FactStore,
  actor: Actor,
  input: { id: string; basis: string; expectedVersion: number },
): FactStore {
  guard(actor, "handle_report");
  const report = store.reports.find((r) => r.id === input.id);
  if (!report) throw new GovernanceError("invalid", "report");
  if (report.version !== input.expectedVersion)
    throw new GovernanceError("version_conflict", String(report.version));
  const to = nextStatus[report.status];
  if (!to) throw new GovernanceError("invalid", "resolved");
  const basis = requireText(input.basis);
  return append(
    store,
    {
      reports: store.reports.map((r) =>
        r.id === report.id ? { ...r, status: to, basis, version: r.version + 1 } : r,
      ),
    },
    { action: "handle_report", actorId: actor.id, at: store.asOf, subject: report.id, from: report.status, to, reason: basis },
  );
}

// Replaces analysable facts with a validated demo handoff; reports and audit stay with the admin store.
export function importHandoff(
  store: FactStore,
  actor: Actor,
  handoff: { asOf: string; data: Dataset; contractVersion: string },
): FactStore {
  guard(actor, "rebuild_snapshot");
  return append(
    store,
    { data: {...handoff.data, users: handoff.data.users.map((u) => ({...u, accountType: (store.accountVersions[u.id] ? store.data.users.find((old) => old.id === u.id)?.accountType : u.accountType) || "regular"}))}, asOf: handoff.asOf },
    { action: "import_handoff", actorId: actor.id, at: handoff.asOf, subject: handoff.contractVersion, to: handoff.asOf, reason: "demo handoff" },
  );
}

// Each snapshot keeps the facts it was built from; later writes never alter it.
export function buildSnapshot(
  store: FactStore,
  previous: Snapshot[],
  source: Snapshot["source"] = "fixture",
): Snapshot {
  const sequence = previous.length + 1;
  return freeze({
    id: `S-${store.asOf.slice(0, 10).replaceAll("-", "")}-${String(sequence).padStart(2, "0")}`,
    sequence,
    asOf: store.asOf,
    definitionVersion: "r1-v3",
    factVersion: store.version,
    source,
    data: structuredClone(store.data),
    sourceStatus: {events: source === "handoff" && !store.data.events.length ? "not_connected" : "available", business: source},
  });
}
// Writes that change analysable facts and are not yet in the snapshot being viewed.
export const pendingWrites = (store: FactStore, snapshot: Snapshot) =>
  store.audit.filter(
    (entry) => entry.version > snapshot.factVersion && ["classify_account", "import_handoff"].includes(entry.action),
  );

function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function requireAction(actor: Actor, action: Action) { guard(actor, action); }
export const reportFixtures: ReportCase[] = [
  {id:"CASE-001",subjectId:"U-013",mealId:"M-038",reason:"coordination",receivedAt:"2026-10-16T20:00:00Z",status:"received",version:1},
];
