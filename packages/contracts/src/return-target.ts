/**
 * Post-login return targets: same-origin paths on an explicit route allowlist, never a URL.
 * The schema pattern rejects network-path forms; isAllowedReturnTarget is the runtime check.
 */
export const RETURN_TARGET_PATTERN = '^/(?![/\\\\])[A-Za-z0-9/_?=&.%-]*$';

/** Client route prefixes a sign-in may return to (Web/iOS deep-link routes). */
export const RETURN_TARGET_PREFIXES = ['/', '/discover', '/meals', '/create', '/inbox', '/profile', '/profiles', '/settings', '/post-meal'] as const;

const SENTINEL_ORIGIN = 'https://return-target.invalid';

export function isAllowedReturnTarget(target: string, prefixes: readonly string[] = RETURN_TARGET_PREFIXES): boolean {
  if (target.length > 300 || !new RegExp(RETURN_TARGET_PATTERN).test(target)) return false;
  let url: URL;
  try {
    url = new URL(target, SENTINEL_ORIGIN);
  } catch {
    return false;
  }
  if (url.origin !== SENTINEL_ORIGIN) return false;
  const path = url.pathname;
  if (path.split('/').some((segment) => segment === '..' || segment === '.')) return false;
  return prefixes.some((prefix) => (prefix === '/' ? path === '/' : path === prefix || path.startsWith(prefix + '/')));
}
