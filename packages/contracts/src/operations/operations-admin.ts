import { DecimalString, Enum, Instant, Obj, T, Text, Uuid } from '../schema.ts';
import { Cursor, Limit } from '../common.ts';
import {
  ADMIN_DRILLDOWN_SORTS, ADMIN_DRILLDOWN_TARGETS, ADMIN_PAGES, ATTENDANCE_VALUES, CLASSIFICATIONS, CLIENT_EVENT_TYPES, REPORT_REASONS, REPORT_TARGET_TYPES, SUPPORT_CASE_STATUSES,
} from '../dictionaries.ts';
import {
  AdminPageData, AttendanceCorrection, Classification, DeletionStatus, DrilldownRow, ExportTicket, IngestResult, Notification,
  ReportReceipt, SnapshotInfo, SupportCase,
} from '../dto.ts';
import { op } from '../operation.ts';

/** 256-bit secret generated and stored by the client before requesting deletion; only its hash is kept. */
const ReceiptToken = T.String({ pattern: '^[A-Za-z0-9_-]{43}$' });
/** Canonical admin filters (measurement contract §5); comma lists, empty = all. */
const AdminFilters = {
  from: T.Optional(T.String({ format: 'date' })),
  to: T.Optional(T.String({ format: 'date' })),
  areas: T.Optional(T.String({ pattern: '^([a-z0-9]+(-[a-z0-9]+)*)(,([a-z0-9]+(-[a-z0-9]+)*))*$', maxLength: 400 })),
  languages: T.Optional(T.String({ pattern: '^(en|zh)(,(en|zh))?$' })),
  budgetBands: T.Optional(T.String({ pattern: '^(0-20|20-30|30-40|40\\+|unknown)(,(0-20|20-30|30-40|40\\+|unknown))*$' })),
  sizes: T.Optional(T.String({ pattern: '^([2-6]|7\\+)(,([2-6]|7\\+))*$' })),
  sources: T.Optional(T.String({ pattern: '^[a-z0-9_-]+(,[a-z0-9_-]+)*$', maxLength: 200 })),
  segments: T.Optional(T.String({ pattern: '^(new|existing)(,(new|existing))?$' })),
  /** Legacy `≤£25/≤£30` links keep their threshold meaning (measurement contract §5); exclusive with budgetBands. */
  budgetUpToPence: T.Optional(T.Integer({ minimum: 1, maximum: 2147483647 })),
};
/** Row filters, search and server-side sort for drill-down lists (UI never filters raw rows). */
const DrilldownRowQuery = {
  mealId: T.Optional(Uuid),
  userId: T.Optional(Uuid),
  cohortWeek: T.Optional(T.String({ format: 'date' })),
  attendanceStatus: T.Optional(Enum(['present', 'absent', 'unknown'] as const)),
  q: T.Optional(T.String({ minLength: 1, maxLength: 80 })),
  sort: T.Optional(Enum(ADMIN_DRILLDOWN_SORTS)),
  order: T.Optional(Enum(['asc', 'desc'] as const)),
};
/** A metric/list id, or `summary.<page>` for the page summary export (admin PRD §3.1). */
const ExportScope = T.String({ pattern: `^(summary\\.(${ADMIN_PAGES.join('|')})|${ADMIN_DRILLDOWN_TARGETS.map((k) => k.replace('.', '\\.')).join('|')})$` });
const ClientEvent = Obj({
  eventId: Uuid,
  type: Enum(CLIENT_EVENT_TYPES),
  occurredAt: Instant,
  anonymousId: T.String({ minLength: 8, maxLength: 64 }),
  sessionId: T.String({ minLength: 8, maxLength: 64 }),
  appVersion: T.String({ minLength: 1, maxLength: 40 }),
  properties: T.Record(T.String({ pattern: '^[a-z][a-zA-Z0-9]*$', maxLength: 40 }), T.Union([T.String({ maxLength: 200 }), T.Number(), T.Boolean(), T.Null()]), { maxProperties: 20 }),
});

export const operationsAdmin = [
  op({
    operationId: 'listNotifications', method: 'GET', path: '/me/notifications', summary: 'Own in-app notifications',
    auth: 'session', write: 'read', ifMatch: false, query: Obj({ cursor: T.Optional(Cursor), limit: T.Optional(Limit) }),
    success: { status: 200, data: Notification, list: true }, errors: [],
  }),
  op({
    operationId: 'markRead', method: 'POST', path: '/me/notifications/{notificationId}/read', summary: 'Mark own notification read',
    auth: 'session', write: 'idempotencyKey', ifMatch: false, params: Obj({ notificationId: Uuid }),
    success: { status: 200, data: Notification }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'createReport', method: 'POST', path: '/reports', summary: 'Private report; returns a receipt, not a resolution',
    auth: 'session', write: 'idempotencyKey', ifMatch: false,
    body: Obj({ targetType: Enum(REPORT_TARGET_TYPES), targetId: Uuid, reason: Enum(REPORT_REASONS), details: Text(1, 1000) }),
    success: { status: 201, data: ReportReceipt }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'reportStatus', method: 'GET', path: '/me/reports/{reportId}', summary: 'Own report status and public outcome',
    auth: 'session', write: 'read', ifMatch: false, params: Obj({ reportId: Uuid }),
    success: { status: 200, data: ReportReceipt }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'requestDeletion', method: 'POST', path: '/me/deletion', summary: 'Delete account (5-minute reauth, synchronous barrier)',
    auth: 'session', write: 'idempotencyKey', ifMatch: true,
    body: Obj({ confirm: T.Literal(true), receiptToken: ReceiptToken }),
    success: { status: 202, data: DeletionStatus }, errors: ['REAUTH_REQUIRED', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'deletionStatus', method: 'POST', path: '/deletion-status', summary: 'Minimal status by receipt (token never in URL)',
    auth: 'receipt', write: 'read', ifMatch: false, body: Obj({ receiptToken: ReceiptToken }),
    success: { status: 200, data: DeletionStatus }, errors: ['NOT_FOUND', 'RECEIPT_EXPIRED'],
  }),
  op({
    operationId: 'supportCase', method: 'GET', path: '/support/cases/{caseId}', summary: 'Case facts for an authorised support actor',
    auth: 'staff', roles: ['support'], write: 'read', ifMatch: false, params: Obj({ caseId: Uuid }),
    success: { status: 200, data: SupportCase }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'correctAttendance', method: 'POST', path: '/support/cases/{caseId}/attendance-corrections', summary: 'Audited correction after end+7d',
    auth: 'staff', roles: ['support'], write: 'idempotencyKey', ifMatch: false, params: Obj({ caseId: Uuid }),
    body: Obj({ mealId: Uuid, subjectId: Uuid, value: Enum(ATTENDANCE_VALUES), reason: Text(5, 500), expectedVersion: DecimalString }),
    success: { status: 201, data: AttendanceCorrection }, errors: ['NOT_FOUND', 'CORRECTION_WINDOW_OPEN', 'VERSION_CONFLICT', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'resolveCase', method: 'POST', path: '/support/cases/{caseId}/status', summary: 'Update case status and public outcome',
    auth: 'staff', roles: ['support'], write: 'idempotencyKey', ifMatch: true, params: Obj({ caseId: Uuid }),
    body: Obj({ status: Enum(SUPPORT_CASE_STATUSES), publicOutcome: T.Union([Text(1, 1000), T.Null()]), reason: Text(5, 500) }),
    success: { status: 200, data: SupportCase }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'listSnapshots', method: 'GET', path: '/admin/snapshots', summary: 'Sealed snapshot metadata',
    auth: 'staff', roles: ['analyst', 'data_admin'], write: 'read', ifMatch: false, query: Obj({ cursor: T.Optional(Cursor), limit: T.Optional(Limit) }),
    success: { status: 200, data: SnapshotInfo, list: true }, errors: [],
  }),
  op({
    operationId: 'adminPage', method: 'GET', path: '/admin/{page}', summary: 'One of the five admin pages bound to a snapshot',
    auth: 'staff', roles: ['analyst', 'data_admin'], write: 'read', ifMatch: false,
    params: Obj({ page: Enum(ADMIN_PAGES) }), query: Obj({ snapshotId: Uuid, ...AdminFilters }),
    success: { status: 200, data: AdminPageData }, errors: ['NOT_FOUND', 'SNAPSHOT_REVOKED'],
  }),
  op({
    operationId: 'adminDrilldown', method: 'GET', path: '/admin/drilldowns/{metric}', summary: 'De-identified source rows for a metric',
    auth: 'staff', roles: ['analyst', 'data_admin'], write: 'read', ifMatch: false,
    params: Obj({ metric: Enum(ADMIN_DRILLDOWN_TARGETS) }),
    query: Obj({ snapshotId: Uuid, filterHash: T.String({ pattern: '^[0-9a-f]{64}$' }), ...AdminFilters, ...DrilldownRowQuery, cursor: T.Optional(Cursor), limit: T.Optional(Limit) }),
    success: { status: 200, data: DrilldownRow, list: true }, errors: ['NOT_FOUND', 'SNAPSHOT_REVOKED'],
  }),
  op({
    operationId: 'adminExport', method: 'POST', path: '/admin/exports', summary: 'Create a short-lived CSV export of the same snapshot',
    auth: 'staff', roles: ['analyst', 'data_admin'], write: 'idempotencyKey', ifMatch: false,
    body: Obj({ snapshotId: Uuid, metric: ExportScope, filters: Obj({ ...AdminFilters, ...DrilldownRowQuery }) }),
    success: { status: 201, data: ExportTicket }, errors: ['NOT_FOUND', 'SNAPSHOT_REVOKED'],
  }),
  op({
    operationId: 'getExport', method: 'GET', path: '/admin/exports/{exportId}',
    summary: 'Stream text/csv (header lines: snapshotId, asOf, canonical filters, definitionVersion; formula-injection safe) after re-checking role and privacy epoch',
    auth: 'staff', roles: ['analyst', 'data_admin'], write: 'read', ifMatch: false, params: Obj({ exportId: Uuid }),
    success: { status: 200 }, errors: ['NOT_FOUND', 'SNAPSHOT_REVOKED', 'RECEIPT_EXPIRED'],
  }),
  op({
    operationId: 'getClassification', method: 'GET', path: '/admin/classifications/{userId}', summary: 'Current classification and revision (for If-Match)',
    auth: 'staff', roles: ['data_admin'], write: 'read', ifMatch: false, params: Obj({ userId: Uuid }),
    success: { status: 200, data: Classification }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'classifyUser', method: 'PUT', path: '/admin/classifications/{userId}', summary: 'data_admin sets regular/test/staff',
    auth: 'staff', roles: ['data_admin'], write: 'idempotencyKey', ifMatch: true, params: Obj({ userId: Uuid }),
    body: Obj({ classification: Enum(CLASSIFICATIONS), reason: Text(5, 500) }),
    success: { status: 200, data: Classification }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'ingestEvents', method: 'POST', path: '/analytics/events', summary: 'Client analytics batch (deduped by eventId)',
    auth: 'optionalSession', write: 'resourceKey', ifMatch: false,
    body: Obj({ schemaVersion: T.Literal(1), consent: Obj({ analytics: T.Boolean(), version: T.String({ minLength: 1, maxLength: 40 }) }), events: T.Array(ClientEvent, { minItems: 0, maxItems: 50 }) }),
    success: { status: 200, data: Obj({ results: T.Array(IngestResult, { maxItems: 50 }) }) }, errors: [],
  }),
] as const;
