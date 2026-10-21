import { ensureRandomUUID } from './polyfills.ts';

// Imported first by app/_layout.tsx, before any SDK call can mint an Idempotency-Key.
ensureRandomUUID();
