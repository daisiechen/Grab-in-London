import { afterEach, beforeEach, vi } from 'vitest';

// Existing synthetic meals close at 2026-10-23T17:30Z. Replay their original pre-close
// conditions in these isolated workers, including when the real calendar advances.
const REPLAY_NOW = Date.parse('2026-10-23T16:00:00.000Z');
beforeEach(() => { vi.setSystemTime(REPLAY_NOW); });
afterEach(() => { vi.useRealTimers(); });
