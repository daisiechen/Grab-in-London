/**
 * One-shot message carried across a navigation (e.g. Edit meal → Save → back on the guest list),
 * read once by the destination. Memory only.
 */
const pending = new Map<string, string>();
export const setFlash = (key: string, message: string) => { pending.set(key, message); };
export function takeFlash(key: string): string | null {
  const message = pending.get(key) ?? null;
  pending.delete(key);
  return message;
}
