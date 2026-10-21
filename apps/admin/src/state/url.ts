import { useCallback, useEffect, useState } from 'react';
import { ADMIN_PAGES } from '@fancy/contracts';
import type { AdminPageName } from '../api/admin-api.ts';
import { parseSearch, toSearch, type UrlState } from './filters.ts';

export const PAGES = ADMIN_PAGES;

export const pageFromHash = (hash: string): AdminPageName =>
  (PAGES as readonly string[]).includes(hash.slice(1)) ? (hash.slice(1) as AdminPageName) : 'overview';

/** Filters, language and snapshot in the query string; page in the hash (PRD §3.1). */
export function useUrlState() {
  const [state, setState] = useState<UrlState>(() => parseSearch(location.search));
  const [page, setPage] = useState<AdminPageName>(() => pageFromHash(location.hash));

  useEffect(() => {
    const onHash = () => setPage(pageFromHash(location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    history.replaceState(null, '', `${toSearch(state)}${location.hash || '#overview'}`);
  }, [state]);

  const update = useCallback((patch: Partial<UrlState>) => setState((prev) => ({ ...prev, ...patch })), []);
  const go = useCallback((target: AdminPageName) => {
    location.hash = target;
    setPage(target);
  }, []);
  return { state, page, update, go };
}
