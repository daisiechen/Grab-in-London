/**
 * Minimal in-memory read cache. Private responses live only in memory (never storage) and the
 * whole cache is cleared on logout, 401 and account deletion (API contract §1).
 */
export class QueryCache {
  private readonly entries = new Map<string, unknown>();
  private readonly listeners = new Set<() => void>();

  get<T>(key: string): T | undefined {
    return this.entries.get(key) as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.entries.set(key, value);
  }

  delete(prefix: string): void {
    for (const key of [...this.entries.keys()]) if (key === prefix || key.startsWith(prefix + ':')) this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
    for (const l of [...this.listeners]) l();
  }

  get size(): number {
    return this.entries.size;
  }

  onClear(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}
