import Constants from 'expo-constants';

/** Dev default is the local API (T04, port 3000). Real devices need a reachable host via app config `extra.apiBaseUrl`. */
export const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export function apiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiBaseUrl?: unknown } | undefined;
  return typeof extra?.apiBaseUrl === 'string' && extra.apiBaseUrl ? extra.apiBaseUrl : DEFAULT_API_BASE_URL;
}

/** Public site serving the legal and support pages (Settings, sign-in sheet, App Store listing). */
export const DEFAULT_LEGAL_BASE_URL = 'https://fancyabite.uk';

export function legalBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { legalBaseUrl?: unknown } | undefined;
  const value = typeof extra?.legalBaseUrl === 'string' && extra.legalBaseUrl ? extra.legalBaseUrl : DEFAULT_LEGAL_BASE_URL;
  return value.replace(/\/+$/, '');
}

/** App deep-link return for system-browser sign-in (registered scheme `fancy`). */
export const AUTH_REDIRECT_URL = 'fancy://auth/callback';

/**
 * Policy versions recorded when the user ticks the 18+/community acknowledgement and when a host
 * accepts terms. CONTRACT GAP: the API exposes no endpoint for the current versions; this constant
 * must be replaced by the server-provided value before release.
 */
export const POLICY_VERSION = '2026-10-21';

/**
 * Ask Fancy (AI helper). Off for this release by owner decision (2026-10-28): no floating entry is
 * shown. The assistant code and its tests stay in place for a later version.
 */
export const ASSISTANT_ENABLED = false;
