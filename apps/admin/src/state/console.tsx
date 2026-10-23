import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { AdminApi, AdminPageData, AdminPageName, SessionInfo, SnapshotInfo } from '../api/admin-api.ts';
import { isBlocking, toFailure, type Failure } from '../api/failure.ts';
import { londonDay } from '../i18n.ts';
import { queryKey, toQuery, type AdminFilters, type FilterQuery } from './filters.ts';
import { emptyBook, reduceIntents, statisticsSettled, type IntentBook, type IntentEvent } from '../features/classification/intent.ts';
import { delayAfter, needsSync, SYNC_INTERVAL_MS, syncIntent } from '../features/classification/sync.ts';

export type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: AdminPageData; query: FilterQuery }
  | { status: 'failed'; failure: Failure };

export interface ConsoleState {
  api: AdminApi;
  /** Session/role gate: a blocking failure hides every data surface. */
  gate: { status: 'loading' } | { status: 'ready' } | { status: 'failed'; failure: Failure };
  session: SessionInfo | null;
  snapshots: SnapshotInfo[];
  snapshot: SnapshotInfo | null;
  /** London day of the selected snapshot's asOf; the latest selectable end date. */
  snapshotDay: string | null;
  /** Newest sealed snapshot when it differs from the selected one; switching is always explicit. */
  newerSnapshot: SnapshotInfo | null;
  pickerOpen: boolean;
  /** Set when the selected snapshot was revoked (410); all cached data has been cleared. */
  revokedNotice: boolean;
  pageState: PageState;
  selectSnapshot(id: string): void;
  openPicker(open: boolean): void;
  refreshSnapshots(): Promise<void>;
  /** Re-requests the current page for the same snapshot and applied query (503/429/network retry). */
  retryPage(): void;
  /** Shared 410/401/403 handling for every snapshot-bound call (page, drilldown, export). */
  reportFailure(error: unknown): Failure;
  /**
   * Captures the current data scope. `live()` turns false once the selection is revoked (410), the
   * session is blocked (401/403), the snapshot or account changes or the console unmounts, so late
   * tickets/CSV/pages of the old scope can never be saved, announced or cached into the new one.
   */
  fence(): { live(): boolean };
  /** Classification intents of the signed-in account (memory only; dropped on account change). */
  intents: IntentBook;
  dispatchIntent(event: IntentEvent): void;
  /**
   * False until every accepted intent is sealed in the selected snapshot (and none is unresolved):
   * charts, drilldowns and exports stay hidden. A ready job never unlocks an older selected snapshot.
   */
  statisticsSettled: boolean;
  /** Current snapshot + canonical filters; null until a snapshot is selected. */
  binding: { snapshotId: string; query: FilterQuery; filterHash: string | null } | null;
}

const Ctx = createContext<ConsoleState | null>(null);

export const useConsole = (): ConsoleState => {
  const value = useContext(Ctx);
  if (!value) throw new Error('useConsole outside ConsoleProvider');
  return value;
};

const newestSealed = (list: SnapshotInfo[]) =>
  list.filter((s) => s.status === 'SEALED').sort((a, b) => b.asOf.localeCompare(a.asOf) || b.createdAt.localeCompare(a.createdAt))[0] ?? null;

export function ConsoleProvider({ api, page, filters, snapshotId, onSnapshotChange, syncIntervalMs = SYNC_INTERVAL_MS, children }: {
  api: AdminApi;
  page: AdminPageName;
  filters: AdminFilters;
  /** Snapshot id persisted in the URL (null = use newest sealed). */
  snapshotId: string | null;
  onSnapshotChange(id: string | null): void;
  syncIntervalMs?: number;
  children: ReactNode;
}) {
  const [gate, setGate] = useState<ConsoleState['gate']>({ status: 'loading' });
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [revokedNotice, setRevokedNotice] = useState(false);
  const [pageState, setPageState] = useState<PageState>({ status: 'idle' });
  const [reloadToken, setReloadToken] = useState(0);
  /** Page responses keyed by account|roles|snapshot|page|filters; cleared entirely on 410/401/403. */
  const cache = useRef(new Map<string, AdminPageData>());
  const [revoked, setRevoked] = useState<ReadonlySet<string>>(new Set());
  const [intents, dispatchIntent] = useReducer(reduceIntents, emptyBook());
  const intentsRef = useRef(intents);
  intentsRef.current = intents;
  const selectedRef = useRef<string | null>(null);
  /** Data-scope generation; bumped by every event that invalidates in-flight results. */
  const generation = useRef(0);

  const snapshot = useMemo(() => {
    if (!snapshotId) return null;
    return snapshots.find((s) => s.id === snapshotId && s.status === 'SEALED' && !revoked.has(s.id)) ?? null;
  }, [snapshots, snapshotId, revoked]);
  const snapshotDay = snapshot ? londonDay(snapshot.asOf) : null;
  selectedRef.current = snapshot?.id ?? null;
  const query = useMemo(() => (snapshotDay ? toQuery(filters, snapshotDay) : null), [filters, snapshotDay]);

  const clearData = useCallback(() => {
    generation.current++;
    cache.current.clear();
    setPageState({ status: 'idle' });
  }, []);

  const reportFailure = useCallback((error: unknown): Failure => {
    const failure = toFailure(error);
    if (failure.kind === 'revoked') {
      clearData();
      if (snapshotId) setRevoked((prev) => new Set(prev).add(snapshotId));
      setRevokedNotice(true);
      setPickerOpen(true);
      onSnapshotChange(null);
      void api.snapshots().then(setSnapshots, () => undefined);
    } else if (isBlocking(failure.kind)) {
      clearData();
      dispatchIntent({ type: 'accountChanged', accountId: null });
      setSnapshots([]);
      setGate({ status: 'failed', failure });
    }
    return failure;
  }, [api, clearData, onSnapshotChange, snapshotId]);

  // A new snapshot selection or API/account instance starts a new scope; unmount ends all scopes.
  useEffect(() => { generation.current++; }, [snapshot?.id, api]);
  useEffect(() => () => { generation.current++; }, []);

  // Session first (CSRF + roles for display), then sealed snapshot metadata.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const s = await api.session();
        const list = await api.snapshots();
        if (!live) return;
        dispatchIntent({ type: 'accountChanged', accountId: s.user.id });
        setSession(s);
        setSnapshots(list);
        setGate({ status: 'ready' });
      } catch (error) {
        if (live) setGate({ status: 'failed', failure: toFailure(error) });
      }
    })();
    return () => { live = false; };
  }, [api]);

  // No (valid) snapshot in the URL: bind the newest sealed one. A revoked selection waits for an explicit pick.
  useEffect(() => {
    if (gate.status !== 'ready' || snapshot || revokedNotice) return;
    const newest = newestSealed(snapshots.filter((s) => !revoked.has(s.id)));
    if (newest && newest.id !== snapshotId) onSnapshotChange(newest.id);
  }, [gate.status, snapshot, snapshots, snapshotId, revoked, revokedNotice, onSnapshotChange]);

  // Responses are locale-independent (labels are translated client-side), so locale is not a key part:
  // switching language neither refetches nor resets the applied query.
  const account = session ? `${session.user.id}|${[...session.user.roles].sort().join(',')}` : null;
  const key = account && snapshot && query ? `${account}|${snapshot.id}|${page}|${queryKey(query)}` : null;
  useEffect(() => {
    if (!key || !snapshot || !query) return;
    const hit = cache.current.get(key);
    if (hit) { setPageState({ status: 'ready', data: hit, query }); return; }
    let live = true;
    setPageState({ status: 'loading' });
    api.page(page, snapshot.id, query).then((data) => {
      if (!live) return;
      cache.current.set(key, data);
      setPageState({ status: 'ready', data, query });
    }, (error: unknown) => {
      if (!live) return;
      const failure = reportFailure(error);
      if (failure.kind !== 'revoked' && !isBlocking(failure.kind)) setPageState({ status: 'failed', failure });
    });
    return () => { live = false; };
    // `key` encodes account, snapshot, page and canonical query; the other values are derived from it.
  }, [key, api, reloadToken]);

  // Reads (never writes) for unresolved intents: receipt while unknown, then the statistics refresh.
  // Each intent is read at most once at a time and not before its Retry-After.
  useEffect(() => {
    const inFlight = new Set<string>();
    const due = new Map<string, number>();
    const timer = setInterval(() => {
      for (const state of Object.values(intentsRef.current.byTarget)) {
        const key = state.intent.key;
        if (!needsSync(state, selectedRef.current) || inFlight.has(key) || (due.get(key) ?? 0) > Date.now()) continue;
        inFlight.add(key);
        void syncIntent(api, state).then((event) => {
          inFlight.delete(key);
          due.set(key, Date.now() + delayAfter(event, syncIntervalMs));
          if (event) dispatchIntent(event);
        });
      }
    }, syncIntervalMs);
    return () => clearInterval(timer);
  }, [api, syncIntervalMs]);

  const refreshSnapshots = useCallback(async () => {
    try { setSnapshots(await api.snapshots()); } catch (error) { reportFailure(error); }
  }, [api, reportFailure]);

  const newest = newestSealed(snapshots.filter((s) => !revoked.has(s.id)));
  const value: ConsoleState = {
    api,
    gate,
    session,
    snapshots,
    snapshot,
    snapshotDay,
    newerSnapshot: snapshot && newest && newest.id !== snapshot.id && newest.asOf > snapshot.asOf ? newest : null,
    pickerOpen,
    revokedNotice,
    pageState,
    selectSnapshot(id) {
      if (revoked.has(id)) return;
      setRevokedNotice(false);
      setPickerOpen(false);
      onSnapshotChange(id);
    },
    openPicker: setPickerOpen,
    refreshSnapshots,
    retryPage() {
      if (key) cache.current.delete(key);
      setReloadToken((n) => n + 1);
    },
    reportFailure,
    intents,
    dispatchIntent,
    statisticsSettled: statisticsSettled(intents, snapshot?.id ?? null),
    fence() {
      const captured = generation.current;
      return { live: () => generation.current === captured };
    },
    binding: snapshot && query ? {
      snapshotId: snapshot.id,
      query,
      filterHash: pageState.status === 'ready' && pageState.data.snapshot.id === snapshot.id ? pageState.data.filterHash : null,
    } : null,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
