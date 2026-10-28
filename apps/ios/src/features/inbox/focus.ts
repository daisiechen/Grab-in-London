/**
 * The meal Inbox should open on next (owner review): after applying, going to Inbox lands on that
 * meal's group chat once there is a seat, or on the Applications tab while the request is pending.
 * Memory only; read once; stale after 30 minutes.
 */
const TTL_MS = 30 * 60_000;
let pending: { mealId: string; at: number } | null = null;
export function focusInboxOn(mealId: string, now = Date.now()) { pending = { mealId, at: now }; }
export function peekInboxFocus(now = Date.now()): string | null {
  if (pending && now - pending.at > TTL_MS) pending = null;
  return pending?.mealId ?? null;
}
export function clearInboxFocus() { pending = null; }
