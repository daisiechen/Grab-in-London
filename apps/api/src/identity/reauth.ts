import { DomainError } from '../common/errors.ts';

export const REAUTH_WINDOW_MS = 5 * 60_000;

/**
 * Sensitive operations (account deletion, identity linking) need a re-authentication that is
 * fresh at the command's effectiveNow: valid iff 0 ≤ now − authTime < 5 minutes. A future
 * authTime never passes.
 */
export function assertFreshAuth(authTime: Date, effectiveNow: Date, message = 'Please sign in again to continue.'): void {
  const age = effectiveNow.getTime() - authTime.getTime();
  if (!(age >= 0 && age < REAUTH_WINDOW_MS)) throw new DomainError('REAUTH_REQUIRED', message);
}
