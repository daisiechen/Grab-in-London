import type { Pool } from 'pg';
import { claimJobs, completeJob, failJob, jobErrorCode, reapExhaustedJobs, type Job } from '@fancy/db';

/**
 * A handler runs one domain command for the job. It must be idempotent: the same job can run
 * again after a crash or lease expiry, so it re-reads state under its own locks. To classify a
 * failure, throw an error with an UPPER_SNAKE `code`; messages are never persisted or forwarded.
 */
export type JobHandler = (job: Job) => Promise<void>;

export interface RunnerOptions {
  pool: Pool;
  owner: string;
  handlers: Readonly<Record<string, JobHandler>>;
  batchSize?: number;
  leaseMs?: number;
  retryBaseMs?: number;
  /** Alert hook; receives only the job identity and an allowlisted error code. */
  onDead?: (job: { id: string; kind: string; resourceId: string }, errorCode: string) => void;
}

export interface TickResult {
  claimed: number;
  done: number;
  retried: number;
  dead: number;
  lost: number;
}

/** Waits pollMs or until aborted, always detaching its abort listener (no per-cycle leak). */
export function idle(signal: AbortSignal, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const onAbort = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export function createRunner(o: RunnerOptions) {
  const kinds = Object.keys(o.handlers);
  async function tick(): Promise<TickResult> {
    const result: TickResult = { claimed: 0, done: 0, retried: 0, dead: 0, lost: 0 };
    for (const job of await reapExhaustedJobs(o.pool, kinds)) {
      result.dead++;
      o.onDead?.(job, 'LEASE_EXPIRED');
    }
    const jobs = await claimJobs(o.pool, { owner: o.owner, kinds, limit: o.batchSize ?? 10, leaseMs: o.leaseMs ?? 60_000 });
    result.claimed = jobs.length;
    for (const job of jobs) {
      try {
        await o.handlers[job.kind]!(job);
        if (await completeJob(o.pool, job)) result.done++;
        else result.lost++;
      } catch (error) {
        const code = jobErrorCode(error);
        const outcome = await failJob(o.pool, job, code, o.retryBaseMs);
        if (outcome === 'DEAD') {
          result.dead++;
          o.onDead?.({ id: job.id, kind: job.kind, resourceId: job.resourceId }, code);
        } else if (outcome === 'RETRY') result.retried++;
        else result.lost++;
      }
    }
    return result;
  }

  /** Poll loop until the signal aborts; a tick that found work polls again immediately. */
  async function run(signal: AbortSignal, pollMs = 1_000): Promise<void> {
    while (!signal.aborted) {
      const { claimed } = await tick();
      if (!claimed) await idle(signal, pollMs);
    }
  }
  return { tick, run };
}
