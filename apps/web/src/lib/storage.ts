/**
 * sessionStorage wrapper for drafts that must survive a same-tab OAuth redirect.
 * Every access is guarded: storage can be absent or throw (private mode, blocked site data),
 * and the app must still work, only losing the draft.
 */
const PREFIX = 'fancy.';

function store(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    store()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* draft persistence is best-effort */
  }
}

export function remove(key: string): void {
  try {
    store()?.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

/** Removes every Fancy key: drafts, pending sign-in state. Called on logout, 401 and deletion. */
export function clearAll(): void {
  const s = store();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
  } catch {
    /* ignore */
  }
}
