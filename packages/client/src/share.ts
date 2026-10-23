/** Public invitation data only. Never serialize a Meal response, actor or application. */
export interface PublicMealShareInput {
  id: string;
  title: string;
  startsAt: {localDate: string; localTime: string; utcOffsetMinutes: number};
  area: string;
  status: 'OPEN' | 'CANCELLED' | 'COMPLETED';
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function publicMealOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('An HTTPS public origin is required.');
  return url.origin;
}
export function mealShareUrl(origin: string, mealId: string): string {
  if (!uuid.test(mealId)) throw new Error('A public meal ID is required.');
  return `${publicMealOrigin(origin)}/meals/${mealId.toLowerCase()}`;
}
/** Incoming universal links accept only the configured host and one public meal detail route. */
export function mealPathFromLink(origin: string, link: string): string | null {
  try {
    const url = new URL(link);
    if (url.origin !== publicMealOrigin(origin) || url.username || url.password || url.search || url.hash) return null;
    const match = /^\/meals\/([^/]+)$/.exec(url.pathname);
    return match && uuid.test(match[1]!) ? `/meals/${match[1]!.toLowerCase()}` : null;
  } catch { return null; }
}
export function publicMealInvitation(origin: string, meal: PublicMealShareInput) {
  if (!['OPEN', 'CANCELLED', 'COMPLETED'].includes(meal.status)) throw new Error('This meal is unavailable for sharing.');
  const url = mealShareUrl(origin, meal.id);
  const offset = meal.startsAt.utcOffsetMinutes;
  if (offset !== 0 && offset !== 60) throw new Error('A London offset is required.');
  const when = `${meal.startsAt.localDate} · ${meal.startsAt.localTime} ${offset === 60 ? 'BST' : 'GMT'} · London`;
  const status = meal.status === 'CANCELLED' ? 'Cancelled' : meal.status === 'COMPLETED' ? 'Ended' : 'Check the latest availability';
  const text = `${meal.title}\n${when}\n${meal.area}\n${status}\nView meal: ${url}`;
  return {title: meal.title, url, text, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(text)}`};
}
