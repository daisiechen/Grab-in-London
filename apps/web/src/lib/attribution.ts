/**
 * Sign-up attribution, held in memory only (no cookies, no storage: PECR — a guest gets no
 * non-essential storage). Captured once from the landing URL: utm_source / utm_medium /
 * utm_campaign, or `meal_link` when the visitor arrived on a shared meal page. Sent with the
 * sign-up request once the API accepts it (`signupSource`, contract pending; see web spec §14).
 */
export type SignupSource =
  | { kind: 'utm'; utmSource: string; utmMedium?: string; utmCampaign?: string }
  | { kind: 'meal_link' };

let arrival: SignupSource | null = null;
let captured = false;

const clean = (v: string | null) => (v ? v.trim().slice(0, 100) || undefined : undefined);

export function captureArrival(href: string): void {
  if (captured) return;
  captured = true;
  let url: URL;
  try { url = new URL(href); } catch { return; }
  const utmSource = clean(url.searchParams.get('utm_source'));
  if (utmSource) {
    const utmMedium = clean(url.searchParams.get('utm_medium'));
    const utmCampaign = clean(url.searchParams.get('utm_campaign'));
    arrival = { kind: 'utm', utmSource, ...(utmMedium ? { utmMedium } : {}), ...(utmCampaign ? { utmCampaign } : {}) };
  } else if (/^\/meals\/[0-9a-f-]{36}(\/[^/]*)?$/i.test(url.pathname)) {
    arrival = { kind: 'meal_link' };
  }
}

/** What to attach to the sign-up/verify request; null when the visit carried no attribution. */
export const signupSource = (): SignupSource | null => arrival;

/** Tests only. */
export function resetAttribution(): void { arrival = null; captured = false; }
