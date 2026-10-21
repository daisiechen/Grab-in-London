import type { PollerDeps } from '../lib/poller.ts';

/** Deterministic timers/visibility for the poller. */
export function fakePollerDeps(random = 0) {
  let now = 0;
  let visible = true;
  const timers: Array<{ at: number; fn: () => void; id: number }> = [];
  let nextId = 1;
  const listeners = new Set<() => void>();
  const deps: PollerDeps = {
    setTimeout: (fn, ms) => { const id = nextId++; timers.push({ at: now + ms, fn, id }); return id; },
    clearTimeout: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    random: () => random,
    isVisible: () => visible,
    onVisibilityChange: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
  const flush = () => new Promise<void>((r) => setTimeout(r, 0));
  return {
    deps,
    pending: () => timers.map((t) => t.at - now),
    async advance(ms: number) {
      now += ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const due = timers[0];
        if (!due || due.at > now) break;
        timers.shift();
        due.fn();
        await flush();
      }
      await flush();
    },
    async setVisible(v: boolean) { visible = v; for (const l of [...listeners]) l(); await flush(); await flush(); },
    flush,
  };
}

