import { isAllowedReturnTarget } from '@fancy/contracts';

/**
 * Where to return after sign-in/profile completion (QA-AUTH-004: the meal target survives a cancelled
 * provider sign-in; the user must still submit actively). Memory only; cleared on logout.
 */
let pending: string | null = null;

export function rememberReturnTo(path: string): void {
  pending = isAllowedReturnTarget(path) ? path : null;
}

export function takeReturnTo(fallback = '/'): string {
  const target = pending ?? fallback;
  pending = null;
  return target;
}

export function peekReturnTo(): string | null {
  return pending;
}

export function clearReturnTo(): void {
  pending = null;
}
