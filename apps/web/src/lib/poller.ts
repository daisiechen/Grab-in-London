/**
 * Foreground message polling (core plan T-06, API §5):
 * - poll immediately on start, then every 2 s while the page is visible;
 * - pause while hidden; on becoming visible, re-check auth first, then catch up at once;
 * - on failure back off 2/4/8/16/30 s (30 s cap) with up to +20% jitter, reset after a success;
 * - a tick returning 'stop' (401 / 403 / dissolved) ends polling for good.
 */
export type TickResult = 'continue' | 'stop';

export interface PollerDeps {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  random: () => number;
  isVisible: () => boolean;
  onVisibilityChange: (listener: () => void) => () => void;
}

export const LIVE_INTERVAL_MS = 2000;
export const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000] as const;
export const JITTER = 0.2;

export const browserPollerDeps = (): PollerDeps => ({
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
  random: Math.random,
  isVisible: () => document.visibilityState !== 'hidden',
  onVisibilityChange: (listener) => {
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  },
});

export function backoffDelay(failures: number, random: () => number): number {
  const base = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1] ?? BACKOFF_MS[0];
  return Math.round(base * (1 + JITTER * random()));
}

export class LivePoller {
  private timer: unknown = null;
  private failures = 0;
  private running = false;
  private stopped = false;
  private inFlight = false;
  private unsubscribe: (() => void) | null = null;
  private readonly tick: () => Promise<TickResult>;
  private readonly deps: PollerDeps;
  private readonly onResume: () => Promise<boolean>;

  /** `onResume` re-validates the session before catching up; false stops polling. */
  constructor(tick: () => Promise<TickResult>, deps: PollerDeps, onResume: () => Promise<boolean> = async () => true) {
    this.tick = tick;
    this.deps = deps;
    this.onResume = onResume;
  }

  /** Last scheduled delay, for tests and diagnostics. */
  lastDelay: number | null = null;

  start(): void {
    if (this.running || this.stopped) return;
    this.running = true;
    this.unsubscribe = this.deps.onVisibilityChange(() => this.visibilityChanged());
    if (this.deps.isVisible()) void this.run();
  }

  stop(): void {
    this.stopped = true;
    this.running = false;
    this.clear();
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  get active(): boolean {
    return this.running && !this.stopped;
  }

  private clear() {
    if (this.timer !== null) this.deps.clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(ms: number) {
    this.clear();
    if (!this.active || !this.deps.isVisible()) return;
    this.lastDelay = ms;
    this.timer = this.deps.setTimeout(() => { this.timer = null; void this.run(); }, ms);
  }

  private async visibilityChanged() {
    if (!this.active) return;
    if (!this.deps.isVisible()) {
      this.clear();
      return;
    }
    let ok: boolean;
    try {
      ok = await this.onResume();
    } catch {
      ok = false;
    }
    if (!ok) {
      this.stop();
      return;
    }
    if (this.active && this.deps.isVisible()) void this.run();
  }

  private async run() {
    if (!this.active || this.inFlight) return;
    this.inFlight = true;
    this.clear();
    try {
      const result = await this.tick();
      if (result === 'stop') {
        this.stop();
        return;
      }
      this.failures = 0;
      this.schedule(LIVE_INTERVAL_MS);
    } catch {
      this.failures += 1;
      this.schedule(backoffDelay(this.failures, this.deps.random));
    } finally {
      this.inFlight = false;
    }
  }
}
