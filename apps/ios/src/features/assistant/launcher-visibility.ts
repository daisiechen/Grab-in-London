import { useEffect, useSyncExternalStore } from 'react';

/** Screens that open an overlay (e.g. Discover's filter dropdowns) hide the floating helper meanwhile. */
const hiders = new Set<symbol>();
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

export function useHideHelperLauncher(hidden: boolean) {
  useEffect(() => {
    if (!hidden) return;
    const token = Symbol('hide-helper');
    hiders.add(token);
    emit();
    return () => { hiders.delete(token); emit(); };
  }, [hidden]);
}

export function useHelperLauncherHidden(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => hiders.size > 0, () => false);
}
