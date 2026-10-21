import { isAllowedReturnTarget } from '@fancy/contracts';

export const DEFAULT_RETURN = '/discover';

/** Same-origin allow-listed path or the default; never an absolute or protocol-relative URL. */
export function safeReturnTo(target: string | null | undefined): string {
  return target && isAllowedReturnTarget(target) ? target : DEFAULT_RETURN;
}

export function signInPath(returnTo: string): string {
  return `/sign-in?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}

export function currentPath(location: { pathname: string; search: string }): string {
  return location.pathname + location.search;
}
