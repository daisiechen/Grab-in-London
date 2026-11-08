import { useSyncExternalStore } from 'react';

/**
 * Set when this tab completes a sign-in (email code or provider callback), so the analytics prompt
 * shows once right after signing in (spec F1.5 / D7) rather than on every reload. Memory only.
 */
let fresh = false;
const listeners = new Set<() => void>();
const notify = () => { for (const l of [...listeners]) l(); };

export function markFreshSignIn(): void { if (!fresh) { fresh = true; notify(); } }
export function clearFreshSignIn(): void { if (fresh) { fresh = false; notify(); } }
export function useFreshSignIn(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => fresh, () => false);
}
