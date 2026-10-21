import { ApiError } from '@fancy/client';

export interface PolledMessage {
  id: string;
  seq: string;
}

export interface PollerDeps<M extends PolledMessage> {
  /** LIVE read after `afterSeq` (null = latest window). Must follow pages internally or return hasMore. */
  fetchAfter: (afterSeq: string | null, cursor: string | null) => Promise<{ messages: M[]; nextCursor: string | null; hasMore: boolean; scannedThroughSeq?: string }>;
  onPage?: (page: {messages:M[];scannedThroughSeq?:string}) => void;
  onMessages: (messages: M[]) => void;
  /** 403: membership interval ended — stop polling and sending, switch the screen to HISTORY. */
  onForbidden: () => void;
  /** 401 after refresh: session ended; polling stops until the screen resumes after sign-in. */
  onSignedOut: () => void;
  onError: (error: ApiError | null) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  random?: () => number;
}

export const LIVE_INTERVAL_MS = 2000;
export const BACKOFF_MS = [2000, 4000, 8000, 16000, 30000] as const;
const MAX_PAGES_PER_TICK = 5;

export const compareSeq = (a: string, b: string) => {
  const x = BigInt(a);
  const y = BigInt(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * Foreground-only message poller (API §5): every 2 s while active, paused in the background,
 * exponential backoff 2/4/8/16/30 s with ±20 % jitter on failure, Retry-After honoured on 429.
 * `resume()` performs an immediate catch-up read from the last seen seq.
 */
export class MessagePoller<M extends PolledMessage> {
  private lastSeq: string | null = null;
  private timer: unknown = null;
  private running = false;
  private inFlight = false;
  private failures = 0;
  private epoch = 0;
  private stopped = false;
  private readonly deps: PollerDeps<M>;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly random: () => number;

  constructor(deps: PollerDeps<M>) {
    this.deps = deps;
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.random = deps.random ?? Math.random;
  }

  /** Seed from the initial load so polling continues after the newest message shown. */
  seed(lastSeq: string | null): void {
    if (lastSeq && (!this.lastSeq || compareSeq(lastSeq, this.lastSeq) > 0)) this.lastSeq = lastSeq;
  }

  get cursorSeq(): string | null {
    return this.lastSeq;
  }

  /** Foreground/visible: poll now and keep polling. */
  resume(): void {
    if (this.stopped) return;
    this.running = true;
    this.cancel();
    void this.tick();
  }

  /** Background/blurred: no requests until resume(). */
  pause(): void {
    this.epoch++;
    this.running = false;
    this.cancel();
  }

  /** Permanent stop (403 / 401 / unmount). */
  stop(): void {
    this.stopped = true;
    this.pause();
  }

  get isRunning(): boolean {
    return this.running && !this.stopped;
  }

  nextDelay(): number {
    if (this.failures === 0) return LIVE_INTERVAL_MS;
    const base = BACKOFF_MS[Math.min(this.failures - 1, BACKOFF_MS.length - 1)]!;
    return Math.round(base * (0.8 + 0.4 * this.random()));
  }

  private cancel() {
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  private schedule(ms: number) {
    this.cancel();
    if (!this.isRunning) return;
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.tick();
    }, ms);
  }

  private async tick(): Promise<void> {
    if (!this.isRunning || this.inFlight) return;
    this.inFlight = true;
    const epoch=this.epoch;
    let retryAfterMs: number | null = null;
    try {
      // Keep afterSeq fixed while following a cursor: the cursor is bound to the original query.
      const after = this.lastSeq;
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PAGES_PER_TICK; page++) {
        const res = await this.deps.fetchAfter(after, cursor);
        if (!this.isRunning || epoch!==this.epoch) return;
        this.deps.onPage?.(res);
        const fresh = res.messages.filter((m) => !this.lastSeq || compareSeq(m.seq, this.lastSeq) > 0).sort((a, b) => compareSeq(a.seq, b.seq));
        if (fresh.length) {
          this.lastSeq = fresh[fresh.length - 1]!.seq;
          this.deps.onMessages(fresh);
        }
        if (!res.hasMore || !res.nextCursor) break;
        cursor = res.nextCursor;
      }
      this.failures = 0;
      this.deps.onError(null);
    } catch (e) {
      // A retired screen/session must never react to an old request (including a late 401).
      if (!this.isRunning || epoch!==this.epoch) return;
      const error = e instanceof ApiError ? e : new ApiError({ status: 0, code: 'NETWORK_ERROR', message: String(e) });
      if (error.kind === 'forbidden' || error.kind === 'not_found' || error.kind === 'gone') {
        this.stop();
        this.deps.onForbidden();
        return;
      }
      if (error.kind === 'auth') {
        this.pause();
        this.deps.onSignedOut();
        return;
      }
      this.failures += 1;
      if (error.kind === 'rate_limit' && error.retryAfterSeconds !== undefined) retryAfterMs = error.retryAfterSeconds * 1000;
      this.deps.onError(error);
    } finally {
      this.inFlight = false;
      if(this.isRunning && epoch!==this.epoch)this.schedule(0);
    }
    this.schedule(retryAfterMs ?? this.nextDelay());
  }
}
