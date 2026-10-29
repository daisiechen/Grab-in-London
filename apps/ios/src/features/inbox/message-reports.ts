import type { QueryCache } from '../../api/cache.ts';

/**
 * Message-level reporting hand-off between the chat and the report page. Both values live only in the
 * in-memory session cache (cleared on sign-out), so message text never travels in a route URL.
 *
 * - The chat stores who wrote the message and an excerpt before opening `/report?targetType=MESSAGE`.
 * - The report page marks the message as reported once the receipt arrives; the chat hides it for this
 *   reporter at once. apps/api masks it for the reporter from then on (`redacted: true`), but LIVE polling
 *   only fetches newer messages, so the already-loaded copy is hidden locally.
 */
export interface MessageSubject { senderName: string; excerpt: string }
const SUBJECT_PREFIX = 'report-message:';
const REPORTED_KEY = 'reported-messages';
const EMPTY: ReadonlySet<string> = new Set();

export function rememberMessageSubject(cache: QueryCache, messageId: string, subject: MessageSubject): void {
  cache.set(SUBJECT_PREFIX + messageId, { senderName: subject.senderName, excerpt: subject.excerpt.slice(0, 140) });
}

export function messageSubject(cache: QueryCache, messageId: string): MessageSubject | null {
  return cache.get<MessageSubject>(SUBJECT_PREFIX + messageId) ?? null;
}

export function markMessageReported(cache: QueryCache, messageId: string): void {
  const current = reportedMessages(cache);
  if (current.has(messageId)) return;
  cache.set(REPORTED_KEY, new Set([...current, messageId]));
}

/** Stable reference until a new report is added (safe as a useSyncExternalStore snapshot). */
export function reportedMessages(cache: QueryCache): ReadonlySet<string> {
  return cache.get<ReadonlySet<string>>(REPORTED_KEY) ?? EMPTY;
}

export const messageReportRoute = (messageId: string) => `/report?targetType=MESSAGE&targetId=${messageId}`;
