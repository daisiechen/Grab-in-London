import { ApiError } from '@fancy/client';
import { BACKOFF_MS, MessagePoller, compareSeq, type PolledMessage } from './poller.ts';
import { deferred, flush } from '../../test/deferred.ts';

function harness(responses: Array<() => Promise<{ messages: PolledMessage[]; nextCursor: string | null; hasMore: boolean }>>) {
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  const calls: Array<{ afterSeq: string | null; cursor: string | null }> = [];
  const received: string[] = [];
  const events: string[] = [];
  const poller = new MessagePoller<PolledMessage>({
    fetchAfter: async (afterSeq, cursor) => {
      calls.push({ afterSeq, cursor });
      const next = responses.shift();
      if (!next) throw new Error('no more scripted responses');
      return next();
    },
    onMessages: (m) => received.push(...m.map((x) => x.seq)),
    onForbidden: () => events.push('forbidden'),
    onSignedOut: () => events.push('signedOut'),
    onError: (e) => events.push(e ? `error:${e.code}` : 'ok'),
    setTimer: (fn, ms) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { cleared: boolean }).cleared = true;
    },
    random: () => 0.5,
  });
  const fire = async () => {
    const t = timers.filter((x) => !x.cleared).pop();
    if (!t) throw new Error('no pending timer');
    t.cleared = true;
    t.fn();
    await flush();
  };
  const pending = () => timers.filter((x) => !x.cleared);
  return { poller, calls, received, events, timers, fire, pending };
}

const msgs = (...seqs: string[]) => async () => ({ messages: seqs.map((seq) => ({ id: `m${seq}`, seq })), nextCursor: null, hasMore: false });
const failing = (e: unknown) => async () => {
  throw e;
};
const net = new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' });

describe('MessagePoller (S14)', () => {
  it('polls every 2 s in the foreground after the last seen seq and de-duplicates', async () => {
    const h = harness([msgs('11', '12'), msgs('12', '13')]);
    h.poller.seed('10');
    h.poller.resume();
    await flush();
    expect(h.calls[0]).toEqual({ afterSeq: '10', cursor: null });
    expect(h.pending().map((t) => t.ms)).toEqual([2000]);
    await h.fire();
    expect(h.calls[1]?.afterSeq).toBe('12');
    expect(h.received).toEqual(['11', '12', '13']);
  });

  it('pauses in the background (no timer, no request) and catches up immediately on resume', async () => {
    const h = harness([msgs('11'), msgs('12', '13')]);
    h.poller.seed('10');
    h.poller.resume();
    await flush();
    h.poller.pause();
    expect(h.pending()).toHaveLength(0);
    expect(h.calls).toHaveLength(1);
    h.poller.resume();
    await flush();
    expect(h.calls).toHaveLength(2);
    expect(h.calls[1]?.afterSeq).toBe('11');
    expect(h.received).toEqual(['11', '12', '13']);
  });

  it('backs off 2/4/8/16/30 s with jitter on failures and resets after success', async () => {
    const h = harness([failing(net), failing(net), failing(net), failing(net), failing(net), failing(net), msgs('1')]);
    h.poller.resume();
    await flush();
    const delays: number[] = [];
    for (let i = 0; i < 6; i++) {
      delays.push(h.pending()[0]!.ms);
      await h.fire();
    }
    expect(delays).toEqual([...BACKOFF_MS, 30000]);
    expect(h.pending()[0]!.ms).toBe(2000);
    expect(h.events.at(-1)).toBe('ok');
  });

  it('jitter stays within ±20 %', () => {
    const low = new MessagePoller({ fetchAfter: async () => ({ messages: [], nextCursor: null, hasMore: false }), onMessages: () => {}, onForbidden: () => {}, onSignedOut: () => {}, onError: () => {}, random: () => 0 });
    (low as unknown as { failures: number }).failures = 1;
    expect(low.nextDelay()).toBe(1600);
    (low as unknown as { random: () => number }).random = () => 1;
    expect(low.nextDelay()).toBe(2400);
  });

  it('honours Retry-After on 429', async () => {
    const h = harness([failing(new ApiError({ status: 429, code: 'RATE_LIMITED', message: 'slow', retryAfterSeconds: 12 }))]);
    h.poller.resume();
    await flush();
    expect(h.pending()[0]?.ms).toBe(12000);
  });

  it('403 stops polling for good and switches to history', async () => {
    const h = harness([failing(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'no' }))]);
    h.poller.resume();
    await flush();
    expect(h.events).toContain('forbidden');
    expect(h.pending()).toHaveLength(0);
    h.poller.resume();
    await flush();
    expect(h.calls).toHaveLength(1);
  });

  it('401 pauses; resuming after sign-in catches up from the last seq', async () => {
    const h = harness([msgs('5'), failing(new ApiError({ status: 401, code: 'AUTH_REQUIRED', message: 'x' })), msgs('6')]);
    h.poller.resume();
    await flush();
    await h.fire();
    expect(h.events).toContain('signedOut');
    expect(h.pending()).toHaveLength(0);
    h.poller.resume();
    await flush();
    expect(h.calls.at(-1)?.afterSeq).toBe('5');
    expect(h.received).toEqual(['5', '6']);
  });

  it('follows pages within one tick', async () => {
    const h = harness([async () => ({ messages: [{ id: 'a', seq: '2' }], nextCursor: 'c1', hasMore: true }), msgs('3')]);
    h.poller.resume();
    await flush();
    expect(h.calls).toEqual([{ afterSeq: null, cursor: null }, { afterSeq: null, cursor: 'c1' }]);
    expect(h.received).toEqual(['2', '3']);
  });

  it('compares seq numerically beyond 2^53', () => {
    expect(compareSeq('9007199254740993', '9007199254740992')).toBe(1);
    expect(compareSeq('10', '9')).toBe(1);
  });
});


describe('poller lifecycle races', () => {
  it('ignores a rejected request after stop without firing signed-out callbacks', async () => {
    const held = deferred<{ messages: PolledMessage[]; nextCursor: string | null; hasMore: boolean }>();
    const h = harness([() => held.promise]);
    h.poller.resume();
    await flush();
    h.poller.stop();
    held.reject(new ApiError({ status: 401, code: 'AUTH_REQUIRED', message: 'old session' }));
    await flush();
    expect(h.events).toEqual([]);
    expect(h.pending()).toHaveLength(0);
  });
});
