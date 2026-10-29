import { isAllowedReturnTarget, RETURN_TARGET_PREFIXES } from '@fancy/contracts';

export const DEFAULT_RETURN = '/discover';

/**
 * Web pages a sign-in may come back to: the contract allowlist plus the iOS-named pages the
 * contract does not list yet (`/chat`, `/profile-setup`, …; web spec §11 gap). Same-origin paths only.
 */
const WEB_RETURN_PREFIXES = [...RETURN_TARGET_PREFIXES, '/chat', '/profile-setup', '/profile-edit', '/notifications', '/report', '/blocked-members', '/delete-account', '/deletion-status', '/survey', '/get-app', '/cancellation-terms'];

/** Same-origin allow-listed path or the default; never an absolute or protocol-relative URL. */
export function safeReturnTo(target: string | null | undefined): string {
  return target && isAllowedReturnTarget(target, WEB_RETURN_PREFIXES) ? target : DEFAULT_RETURN;
}

/** What the API may be told (`returnTarget`): only targets its contract accepts; the web keeps the rest itself. */
export function contractReturnTarget(target: string): string | undefined {
  return isAllowedReturnTarget(target) ? target : undefined;
}

export function signInPath(returnTo: string): string {
  return `/sign-in?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}

export function currentPath(location: { pathname: string; search: string }): string {
  return location.pathname + location.search;
}
