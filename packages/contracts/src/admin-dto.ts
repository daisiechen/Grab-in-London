/** PATCH-006 admin-only DTOs (kept apart from the shared dto.ts). */
import { DecimalString, Enum, Instant, Obj, T, Uuid } from './schema.ts';
import { CLASSIFICATIONS } from './dictionaries.ts';

export const STATISTICS_REFRESH_STATES = ['pending', 'ready', 'failed'] as const;
export const STATISTICS_REFRESH_FAILURES = ['SNAPSHOT_FAILED', 'NOT_INCORPORATED'] as const;

/**
 * Statistics refresh for one accepted classification intent. `ready` means `snapshotId` sealed this
 * target user's `acceptedRevision` or a later revision of the same user; revisions of different
 * users are never compared. Failure concerns statistics only, never the accepted classification.
 */
export const StatisticsRefresh = Obj({
  refreshId: Uuid,
  targetUserId: Uuid,
  acceptedRevision: DecimalString,
  state: Enum(STATISTICS_REFRESH_STATES),
  snapshotId: T.Union([Uuid, T.Null()]),
  failureCode: T.Union([Enum(STATISTICS_REFRESH_FAILURES), T.Null()]),
  updatedAt: Instant,
});

/** Accepted classification receipt; replayed verbatim for the same actor + operation + key. */
export const ClassificationAccepted = Obj({
  userId: Uuid,
  classification: Enum(CLASSIFICATIONS),
  revision: DecimalString,
  snapshotPending: T.Boolean(),
  statisticsRefresh: StatisticsRefresh,
});
