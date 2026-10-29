import { useCallback, useEffect, useState } from 'react';
import { ADMIN_PAGES } from '@fancy/contracts';
import type { AdminPageName } from '../api/admin-api.ts';
import { parseSearch, toSearch, type UrlState } from './filters.ts';

export const PAGES = ADMIN_PAGES;

/** Analytics pages, or the moderation workspace (queue, or one report by id). */
export type Route = { kind: 'analytics'; page: AdminPageName } | { kind: 'moderation'; reportId: string | null };

const REPORT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const pageFromHash = (hash: string): AdminPageName =>
  (PAGES as readonly string[]).includes(hash.slice(1)) ? (hash.slice(1) as AdminPageName) : 'overview';

export function routeFromHash(hash: string): Route {
  const [head, id] = hash.slice(1).split('/');
  if (head === 'moderation') return { kind: 'moderation', reportId: id && REPORT_ID.test(id) ? id.toLowerCase() : null };
  return { kind: 'analytics', page: pageFromHash(hash) };
}

export const hashFor = (route: Route) => (route.kind === 'analytics' ? `#${route.page}` : route.reportId ? `#moderation/${route.reportId}` : '#moderation');

/** Filters, language and snapshot in the query string; page or moderation route in the hash (PRD §3.1). */
export function useUrlState() {
  const [state, setState] = useState<UrlState>(() => parseSearch(location.search));
  const [route, setRoute] = useState<Route>(() => routeFromHash(location.hash));
  const [page, setPage] = useState<AdminPageName>(() => pageFromHash(location.hash));

  useEffect(() => {
    const onHash = () => {
      const next = routeFromHash(location.hash);
      setRoute(next);
      if (next.kind === 'analytics') setPage(next.page);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    history.replaceState(null, '', `${toSearch(state)}${location.hash || '#overview'}`);
  }, [state]);

  const update = useCallback((patch: Partial<UrlState>) => setState((prev) => ({ ...prev, ...patch })), []);
  const navigate = useCallback((target: Route) => {
    location.hash = hashFor(target);
    setRoute(target);
    if (target.kind === 'analytics') setPage(target.page);
  }, []);
  const go = useCallback((target: AdminPageName) => navigate({ kind: 'analytics', page: target }), [navigate]);
  return { state, page, route, update, go, navigate };
}
