import type { QueryCache } from '../../api/queryCache.ts';

/**
 * Message-level reporting hand-off between the chat and the report page (iOS message-reports.ts). Both
 * values live only in the in-memory query cache (cleared on sign-out), so message text never travels in
 * a URL. The chat stores the sender and an excerpt before opening the report page; the report page marks
 * the message reported once the receipt arrives, and the chat hides it for this reporter straight away.
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

export function reportedMessages(cache: QueryCache): ReadonlySet<string> {
  return cache.get<ReadonlySet<string>>(REPORTED_KEY) ?? EMPTY;
}

export const messageReportRoute = (messageId: string) => `/report?targetType=MESSAGE&targetId=${messageId}`;
