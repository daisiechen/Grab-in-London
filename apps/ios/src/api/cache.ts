type Listener = () => void;

/**
 * In-memory cache for private API reads. Never persisted; `clear()` runs on logout, session expiry,
 * account deletion and permission loss so no private data outlives the session (API §1).
 */
export class QueryCache {
  private readonly entries = new Map<string, unknown>();
  private readonly listeners = new Set<Listener>();

  get<T>(key: string): T | undefined {
    return this.entries.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.entries.set(key, value);
    this.emit();
  }

  delete(key: string): void {
    if (this.entries.delete(key)) this.emit();
  }

  /** Removes every key starting with `prefix` (e.g. `meal:` after a 403). */
  invalidate(prefix: string): void {
    let changed = false;
    for (const key of [...this.entries.keys()]) if (key.startsWith(prefix)) changed = this.entries.delete(key) || changed;
    if (changed) this.emit();
  }

  clear(): void {
    this.entries.clear();
    this.emit();
  }

  get size(): number {
    return this.entries.size;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l();
  }
}
