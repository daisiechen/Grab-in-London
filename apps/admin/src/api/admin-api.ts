import { createApiClient, newIntentKey, type ApiClient, type CommandReceipt, type RequestOf, type ResponseOf } from '@fancy/client';
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
export type ClassificationAccepted = ResponseOf<'classifyUser'>['data'];
export type StatisticsRefresh = ResponseOf<'getStatisticsRefresh'>['data'];
export type DrilldownTarget = RequestOf<'adminDrilldown'>['params']['metric'];
export type ExportScope = RequestOf<'adminExport'>['body']['metric'];
export type RowQuery = Omit<NonNullable<RequestOf<'adminDrilldown'>['query']>, 'snapshotId' | 'filterHash' | 'cursor' | 'limit' | keyof FilterQuery>;

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
  /** data_admin only (server-enforced); If-Match = current revision; the receipt carries this intent's statistics refresh. */
  classify(userId: string, input: { classification: ClassificationValue; reason: string }, revision: string, idempotencyKey: string): Promise<ClassificationAccepted>;
  /** Original-intent receipt of the caller's own key (no stored body). */
  classifyReceipt(idempotencyKey: string): Promise<CommandReceipt>;
  /** Locates this intent's refresh by the caller's own key + frozen target + receipt revision. */
  findStatisticsRefresh(idempotencyKey: string, targetUserId: string, acceptedRevision: string): Promise<StatisticsRefresh>;
  statisticsRefresh(refreshId: string): Promise<StatisticsRefresh>;
  /** Reopens failed statistics only; never re-sends the classification. */
  retryStatisticsRefresh(refreshId: string, idempotencyKey: string): Promise<StatisticsRefresh>;
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
    async classifyReceipt(key) {
      const { data } = await client.call('getCommandReceipt', { params: { operation: 'classifyUser', key } });
      return data;
    },
    async findStatisticsRefresh(intentKey, targetUserId, acceptedRevision) {
      const { data } = await client.call('findStatisticsRefreshByIntent', { params: { intentKey, targetUserId, acceptedRevision } });
      return data;
    },
    async statisticsRefresh(refreshId) {
      const { data } = await client.call('getStatisticsRefresh', { params: { refreshId } });
      return data;
    },
    async retryStatisticsRefresh(refreshId, idempotencyKey) {
      const { data } = await client.call('retryStatisticsRefresh', { params: { refreshId }, idempotencyKey });
      return data;
    },
  };
}

export const hasRole = (session: SessionInfo | null, role: 'analyst' | 'data_admin') =>
  !!session?.user.roles.includes(role);
