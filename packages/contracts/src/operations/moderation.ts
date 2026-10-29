/**
 * Moderation back office (owner decision 2026-10-28, App Store guideline 1.2): staff with the
 * existing `support` role triage member reports. Reading a report's private facts or acting on it
 * requires claiming it first, which records a case grant (the same grant J09 support operations use).
 */
import { Enum, Obj, T, Text, Uuid } from '../schema.ts';
import { Cursor, Limit } from '../common.ts';
import { MODERATION_ACTIONS, MODERATION_QUEUE_STATUSES, REPORT_TARGET_TYPES } from '../dictionaries.ts';
import { CaseAttendance, ModerationReport, ModerationReportSummary } from '../dto.ts';
import { op } from '../operation.ts';

export const moderationOperations = [
  op({
    operationId: 'listModerationReports', method: 'GET', path: '/moderation/reports',
    summary: 'Report queue: OPEN oldest first (24h response target), RESOLVED/ALL newest first; metadata only',
    auth: 'staff', roles: ['support'], write: 'read', ifMatch: false,
    query: Obj({
      status: T.Optional(Enum(MODERATION_QUEUE_STATUSES)),
      targetType: T.Optional(Enum(REPORT_TARGET_TYPES)),
      /** `me`: only reports this staff member has claimed. */
      claimed: T.Optional(Enum(['me'] as const)),
      cursor: T.Optional(Cursor),
      limit: T.Optional(Limit),
    }),
    success: { status: 200, data: ModerationReportSummary, list: true }, errors: [],
  }),
  op({
    operationId: 'claimModerationReport', method: 'POST', path: '/moderation/reports/{reportId}/claim',
    summary: 'Take a report for review: grants this staff member the case (audited) and moves it to in review',
    auth: 'staff', roles: ['support'], write: 'idempotencyKey', ifMatch: false, params: Obj({ reportId: Uuid }),
    success: { status: 200, data: ModerationReport }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'getModerationReport', method: 'GET', path: '/moderation/reports/{reportId}',
    summary: 'Minimum context of a claimed report (audited read)',
    auth: 'staff', roles: ['support'], write: 'read', ifMatch: false, params: Obj({ reportId: Uuid }),
    success: { status: 200, data: ModerationReport }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'getModerationPhoto', method: 'GET', path: '/moderation/reports/{reportId}/photo',
    summary: 'Current photo of a reported profile for a claimed USER report, even while hidden or suspended',
    auth: 'staff', roles: ['support'], write: 'read', ifMatch: false, params: Obj({ reportId: Uuid }),
    success: { status: 200, media: 'image/jpeg' }, errors: ['NOT_FOUND'],
  }),
  op({
    operationId: 'moderateReport', method: 'POST', path: '/moderation/reports/{reportId}/actions',
    summary: 'Apply one audited moderation action (If-Match = case version); optionally close with a reporter-visible outcome',
    auth: 'staff', roles: ['support'], write: 'idempotencyKey', ifMatch: true, params: Obj({ reportId: Uuid }),
    body: Obj({
      action: Enum(MODERATION_ACTIONS),
      /** Internal note, staff-only. */
      note: Text(5, 1000),
      /** Reporter-visible outcome when the case closes; null uses the standard wording for the action. */
      publicOutcome: T.Optional(T.Union([Text(1, 1000), T.Null()])),
      /** Close the case after an action that does not close it by itself. */
      resolve: T.Optional(T.Boolean()),
    }),
    success: { status: 200, data: ModerationReport }, errors: ['NOT_FOUND', 'STATE_CONFLICT'],
  }),
  op({
    operationId: 'supportCaseAttendance', method: 'GET', path: '/support/cases/{caseId}/attendance',
    summary: 'Start-roster attendance facts and current revisions for a granted MEAL case (J09)',
    auth: 'staff', roles: ['support'], write: 'read', ifMatch: false, params: Obj({ caseId: Uuid }),
    success: { status: 200, data: CaseAttendance }, errors: ['NOT_FOUND', 'STATE_CONFLICT'],
  }),
] as const;

