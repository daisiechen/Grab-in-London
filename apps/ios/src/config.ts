import Constants from 'expo-constants';

/** Dev default is the local API (T04, port 3000). Real devices need a reachable host via app config `extra.apiBaseUrl`. */
export const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export function apiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: unknown } | undefined;
  return typeof extra?.apiBaseUrl === 'string' && extra.apiBaseUrl ? extra.apiBaseUrl : DEFAULT_API_BASE_URL;
}

/** App deep-link return for system-browser sign-in (registered scheme `fancy`). */
export const AUTH_REDIRECT_URL = 'fancy://auth/callback';

/**
 * Policy versions recorded when the user ticks the 18+/community acknowledgement and when a host
 * accepts terms. CONTRACT GAP: the API exposes no endpoint for the current versions; this constant
 * must be replaced by the server-provided value before release.
 */
export const POLICY_VERSION = '2026-10-21';
