import { describe, expect, it } from 'vitest';
import { BACKOFF_MS, LivePoller, backoffDelay, type TickResult } from './poller.ts';
import { fakePollerDeps as fakeDeps } from '../test/fakePoller.ts';

describe('LivePoller (T12)', () => {
  it('polls immediately and then every 2 s while visible', async () => {
    const f = fakeDeps();
    let ticks = 0;
    const p = new LivePoller(async () => { ticks++; return 'continue'; }, f.deps);
    p.start();
    await f.flush();
    expect(ticks).toBe(1);
    expect(f.pending()).toEqual([2000]);
    await f.advance(2000);
    await f.advance(2000);
    expect(ticks).toBe(3);
  });

  it('backs off 2/4/8/16/30 s on consecutive failures, caps at 30 s, and resets after success', async () => {
    const f = fakeDeps(0);
    let fail = true;
    const p = new LivePoller(async () => { if (fail) throw new Error('offline'); return 'continue'; }, f.deps);
    p.start();
    await f.flush();
    const delays: number[] = [];
    for (let i = 0; i < 6; i++) {
      delays.push(f.pending()[0]!);
      await f.advance(f.pending()[0]!);
    }
    expect(delays).toEqual([2000, 4000, 8000, 16000, 30000, 30000]);
    fail = false;
    await f.advance(f.pending()[0]!);
    expect(f.pending()).toEqual([2000]);
  });

  it('adds up to +20% jitter', () => {
    expect(backoffDelay(1, () => 0)).toBe(2000);
    expect(backoffDelay(1, () => 1)).toBe(2400);
    expect(backoffDelay(9, () => 0.5)).toBe(33000);
    expect(BACKOFF_MS.at(-1)).toBe(30000);
  });

  it('pauses while hidden and re-checks auth before catching up on return', async () => {
    const f = fakeDeps();
    let ticks = 0;
    const order: string[] = [];
    const p = new LivePoller(async () => { ticks++; order.push('tick'); return 'continue'; }, f.deps, async () => { order.push('auth'); return true; });
    p.start();
    await f.flush();
    await f.setVisible(false);
    expect(f.pending()).toEqual([]);
    await f.advance(60000);
    expect(ticks).toBe(1);
    await f.setVisible(true);
    expect(order).toEqual(['tick', 'auth', 'tick']);
  });

  it('stops for good when the resume auth check fails', async () => {
    const f = fakeDeps();
    let ticks = 0;
    const p = new LivePoller(async () => { ticks++; return 'continue'; }, f.deps, async () => false);
    p.start();
    await f.flush();
    await f.setVisible(false);
    await f.setVisible(true);
    await f.advance(10000);
    expect(ticks).toBe(1);
    expect(p.active).toBe(false);
  });

  it('a tick returning stop (403 → HISTORY) ends polling', async () => {
    const f = fakeDeps();
    const results: TickResult[] = ['continue', 'stop'];
    let ticks = 0;
    const p = new LivePoller(async () => results[ticks++] ?? 'continue', f.deps);
    p.start();
    await f.flush();
    await f.advance(2000);
    expect(ticks).toBe(2);
    expect(f.pending()).toEqual([]);
    expect(p.active).toBe(false);
  });

  it('does not start while hidden, and starts polling when shown', async () => {
    const f = fakeDeps();
    await f.setVisible(false);
    let ticks = 0;
    const p = new LivePoller(async () => { ticks++; return 'continue'; }, f.deps);
    p.start();
    await f.flush();
    expect(ticks).toBe(0);
    await f.setVisible(true);
    expect(ticks).toBe(1);
  });
});
