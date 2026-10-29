import { createApiClient, newIntentKey, type ApiClient, type RequestOf, type ResponseOf } from '@fancy/client';
import type { FilterQuery } from '../state/filters.ts';

export type SnapshotInfo = ResponseOf<'listSnapshots'>['data'][number];
export type AdminPageData = ResponseOf<'adminPage'>['data'];
export type AdminPageName = AdminPageData['page'];
export type DrilldownRow = ResponseOf<'adminDrilldown'>['data'][number];
export type DrilldownPage = ResponseOf<'adminDrilldown'>;
export type ExportTicket = ResponseOf<'adminExport'>['data'];
export type SessionInfo = ResponseOf<'getSession'>['data'];
export type ClassificationInfo = ResponseOf<'getClassification'>['data'];
export type ClassificationValue = ClassificationInfo['classification'];
export type DrilldownTarget = RequestOf<'adminDrilldown'>['params']['metric'];
export type ExportScope = RequestOf<'adminExport'>['body']['metric'];
export type RowQuery = Omit<NonNullable<RequestOf<'adminDrilldown'>['query']>, 'snapshotId' | 'filterHash' | 'cursor' | 'limit' | keyof FilterQuery>;
export type ModerationSummary = ResponseOf<'listModerationReports'>['data'][number];
export type ModerationPage = ResponseOf<'listModerationReports'>;
export type ModerationReport = ResponseOf<'getModerationReport'>['data'];
export type ModerationAction = RequestOf<'moderateReport'>['body']['action'];
export type ModerationQuery = NonNullable<RequestOf<'listModerationReports'>['query']>;
export type SupportCaseInfo = ResponseOf<'supportCase'>['data'];
export type CaseAttendance = ResponseOf<'supportCaseAttendance'>['data'];
export type CaseStatus = RequestOf<'resolveCase'>['body']['status'];
export type SignInOutcome = ResponseOf<'verifyEmail'>['data'];

/**
 * The admin console's only data path: typed SDK calls to the API. No canned sample data, no local metric
 * computation and no browser-side persistence of business data.
 */
export interface AdminApi {
  session(): Promise<SessionInfo>;
  snapshots(): Promise<SnapshotInfo[]>;
  page(page: AdminPageName, snapshotId: string, query: FilterQuery): Promise<AdminPageData>;
  drilldown(metric: DrilldownTarget, snapshotId: string, filterHash: string, query: FilterQuery, rows?: RowQuery, page?: { cursor?: string | undefined; limit?: number }): Promise<DrilldownPage>;
  /** One user intent = one idempotency key; the caller keeps it for retries of the same intent. */
  createExport(input: { snapshotId: string; metric: ExportScope; filters: FilterQuery & RowQuery }, idempotencyKey?: string): Promise<ExportTicket>;
  downloadExport(exportId: string): Promise<string>;
  getClassification(userId: string): Promise<ClassificationInfo>;
  /** data_admin only (server-enforced); If-Match = current revision; returns snapshotPending for the new snapshot. */
  classify(userId: string, input: { classification: ClassificationValue; reason: string }, revision: string, idempotencyKey: string): Promise<ClassificationInfo>;

  // Staff sign-in on the Web origin (cookie session). MFA comes from the identity provider.
  /** Hosted provider login with MFA requested; the browser goes to the returned URL and comes back to /admin/. */
  startSecureSignIn(): Promise<{ authorizationUrl: string }>;
  /** Email code (development builds only: an email code alone never carries MFA in production). */
  startSignIn(email: string): Promise<{ challengeId: string }>;
  verifySignIn(challengeId: string, code: string): Promise<SignInOutcome>;
  signOut(): Promise<void>;

  // Moderation (support role, server-enforced).
  moderationReports(query: ModerationQuery): Promise<ModerationPage>;
  claimReport(reportId: string, idempotencyKey: string): Promise<ModerationReport>;
  moderationReport(reportId: string): Promise<ModerationReport>;
  /** If-Match = case version; one intent key per reviewed action, reused only to retry the same action. */
  moderate(reportId: string, input: { action: ModerationAction; note: string; publicOutcome?: string | null; resolve?: boolean }, caseVersion: string, idempotencyKey: string): Promise<ModerationReport>;

  // J09 case operations (same calls as apps/support-cli: case facts, attendance correction, reply/resolve).
  supportCase(caseId: string): Promise<SupportCaseInfo>;
  caseAttendance(caseId: string): Promise<CaseAttendance>;
  correctAttendance(caseId: string, input: { mealId: string; subjectId: string; value: 'present' | 'absent'; reason: string; expectedVersion: string }, idempotencyKey: string): Promise<{ version: string }>;
  resolveCase(caseId: string, input: { status: CaseStatus; publicOutcome: string | null; reason: string }, caseVersion: string, idempotencyKey: string): Promise<SupportCaseInfo>;
}

export interface AdminApiOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export function createAdminApi(options: AdminApiOptions = {}): AdminApi {
  let csrf: string | null = null;
  const client: ApiClient = createApiClient({
    baseUrl: options.baseUrl ?? '',
    credentials: { kind: 'cookie', csrfToken: () => csrf },
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  return {
    async session() {
      const { data } = await client.call('getSession', {});
      csrf = data.csrfToken ?? null;
      return data;
    },
    async snapshots() {
      const { data } = await client.call('listSnapshots', { query: {} });
      return data;
    },
    async page(page, snapshotId, query) {
      const { data } = await client.call('adminPage', { params: { page }, query: { snapshotId, ...query } });
      return data;
    },
    drilldown(metric, snapshotId, filterHash, query, rows = {}, page = {}) {
      return client.call('adminDrilldown', {
        params: { metric },
        query: { snapshotId, filterHash, ...query, ...rows, ...(page.cursor ? { cursor: page.cursor } : {}), ...(page.limit ? { limit: page.limit } : {}) },
      });
    },
    async createExport(input, idempotencyKey = newIntentKey()) {
      const { data } = await client.call('adminExport', { body: input, idempotencyKey });
      return data;
    },
    async downloadExport(exportId) {
      const body: unknown = await client.call('getExport', { params: { exportId } });
      if (typeof body !== 'string') throw new TypeError('Export did not return CSV text');
      return body;
    },
    async getClassification(userId) {
      const { data } = await client.call('getClassification', { params: { userId } });
      return data;
    },
    async classify(userId, input, revision, idempotencyKey) {
      const { data } = await client.call('classifyUser', { params: { userId }, body: input, ifMatch: revision, idempotencyKey });
      return data;
    },
    async startSecureSignIn() {
      const { data } = await client.call('startStaffSignIn', { body: { clientRequestId: newIntentKey() } });
      return { authorizationUrl: data.authorizationUrl };
    },
    async startSignIn(email) {
      const { data } = await client.call('startEmail', { body: { clientRequestId: newIntentKey(), email, client: 'WEB' } });
      return { challengeId: data.challengeId };
    },
    async verifySignIn(challengeId, code) {
      const { data } = await client.call('verifyEmail', { body: { clientRequestId: newIntentKey(), challengeId, code } });
      if (data.outcome === 'AUTHENTICATED' && 'session' in data && data.session) csrf = data.session.csrfToken ?? null;
      return data;
    },
    async signOut() {
      await client.call('logout', { body: { clientRequestId: newIntentKey() } });
      csrf = null;
    },
    moderationReports(query) {
      return client.call('listModerationReports', { query });
    },
    async claimReport(reportId, idempotencyKey) {
      const { data } = await client.call('claimModerationReport', { params: { reportId }, idempotencyKey });
      return data;
    },
    async moderationReport(reportId) {
      const { data } = await client.call('getModerationReport', { params: { reportId } });
      return data;
    },
    async moderate(reportId, input, caseVersion, idempotencyKey) {
      const { data } = await client.call('moderateReport', { params: { reportId }, body: input, ifMatch: caseVersion, idempotencyKey });
      return data;
    },
    async supportCase(caseId) {
      const { data } = await client.call('supportCase', { params: { caseId } });
      return data;
    },
    async caseAttendance(caseId) {
      const { data } = await client.call('supportCaseAttendance', { params: { caseId } });
      return data;
    },
    async correctAttendance(caseId, input, idempotencyKey) {
      // expectedVersion travels in the body (attendance revision), not If-Match — same as the support CLI.
      const { data } = await client.call('correctAttendance', { params: { caseId }, body: input, idempotencyKey });
      return { version: data.version };
    },
    async resolveCase(caseId, input, caseVersion, idempotencyKey) {
      const { data } = await client.call('resolveCase', { params: { caseId }, body: input, ifMatch: caseVersion, idempotencyKey });
      return data;
    },
  };
}

export const hasRole = (session: SessionInfo | null, role: 'analyst' | 'data_admin' | 'support') =>
  !!session?.user.roles.includes(role);
/** Analytics pages need analyst or data_admin; the server enforces it on every call. */
export const hasAnalytics = (session: SessionInfo | null) => hasRole(session, 'analyst') || hasRole(session, 'data_admin');
