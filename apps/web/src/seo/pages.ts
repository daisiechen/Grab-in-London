import type { ResponseOf } from '@fancy/client';
import { DISCOVER_DESCRIPTION, DISCOVER_TITLE, HOME_DESCRIPTION, HOME_TITLE, mealDescription, mealIndexable, mealJsonLd, mealPath, mealSlug, mealTitle } from './meal-seo.ts';
import { renderHead } from './head.ts';

/*
 * Route → head decision for the meta server, independent of HTTP so it can be unit-tested.
 * Account and flow pages are `noindex, nofollow` and also disallowed in robots.txt.
 */

type Meal = ResponseOf<'getMeal'>['data']['meal'];
type Profile = ResponseOf<'getPublicProfile'>['data']['profile'];

export interface PageLoaders {
  meal(id: string): Promise<Meal | null>;
  profile(id: string): Promise<Profile | null>;
  areaName(code: string): string;
  now(): number;
}

export type PageResult =
  | { kind: 'html'; status: 200 | 404; head: string }
  | { kind: 'redirect'; status: 301; location: string };

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const MEAL = new RegExp(`^/meals/(${UUID})(?:/([^/]*))?$`, 'i');
const PROFILE = new RegExp(`^/profiles/(${UUID})$`, 'i');
const SUBPAGES = new Set(['apply', 'status', 'host', 'edit']);
export const PRIVATE_PREFIXES = ['/sign-in', '/auth/', '/profile-setup', '/profile-edit', '/profile', '/meals', '/inbox', '/notifications', '/chat/', '/create', '/settings', '/survey', '/report', '/blocked-members', '/delete-account', '/deletion-status', '/post-meal/'];

const isPrivate = (path: string) => PRIVATE_PREFIXES.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(`${p}/`)));
const unavailable = (): PageResult => ({ kind: 'html', status: 404, head: renderHead({ title: 'This table isn’t available · Fancy', robots: 'noindex' }) });

export async function headFor(pathname: string, search: string, load: PageLoaders): Promise<PageResult> {
  if (pathname === '/') return { kind: 'html', status: 200, head: renderHead({ title: HOME_TITLE, description: HOME_DESCRIPTION, canonical: '/' }) };
  if (pathname === '/discover') return { kind: 'html', status: 200, head: renderHead({ title: DISCOVER_TITLE, description: DISCOVER_DESCRIPTION, canonical: '/discover', robots: search && search !== '?' ? 'noindex' : 'index' }) };
  if (pathname === '/get-app') return { kind: 'html', status: 200, head: renderHead({ title: 'The Fancy app · Fancy', canonical: '/get-app' }) };
  if (pathname === '/cancellation-terms') return { kind: 'html', status: 200, head: renderHead({ title: 'Cancellation terms · Fancy', canonical: '/cancellation-terms' }) };
  const meal = MEAL.exec(pathname);
  if (meal && !SUBPAGES.has(meal[2] ?? '')) {
    const found = await load.meal(meal[1]!.toLowerCase());
    if (!found) return unavailable();
    // One canonical address: a missing or stale title fragment answers 301 (spec D5).
    if ((meal[2] ?? '') !== mealSlug(found.title)) return { kind: 'redirect', status: 301, location: mealPath(found) + search };
    const area = load.areaName(found.areaCode);
    const indexable = mealIndexable(found, load.now());
    return {
      kind: 'html', status: 200,
      head: renderHead({ title: mealTitle(found, area), description: mealDescription(found, area), canonical: mealPath(found), robots: indexable ? 'index' : 'noindex', jsonLd: indexable ? mealJsonLd(found, area) : undefined }),
    };
  }
  const profile = PROFILE.exec(pathname);
  if (profile) {
    const found = await load.profile(profile[1]!.toLowerCase());
    if (!found) return { kind: 'html', status: 404, head: renderHead({ title: 'This profile isn’t available · Fancy', robots: 'noindex' }) };
    return { kind: 'html', status: 200, head: renderHead({ title: `${found.displayName} on Fancy`, robots: 'noindex', canonical: `/profiles/${found.id}` }) };
  }
  if (isPrivate(pathname)) {
    return { kind: 'html', status: 200, head: renderHead({ title: 'Fancy', robots: 'noindex, nofollow' }) };
  }
  return { kind: 'html', status: 404, head: renderHead({ title: 'Page not found · Fancy', robots: 'noindex' }) };
}

export function robotsTxt(origin: string): string {
  const disallow = PRIVATE_PREFIXES.filter((p) => p !== '/meals').map((p) => `Disallow: ${p}`);
  return ['User-agent: *', 'Allow: /', ...disallow, 'Disallow: /meals$', 'Disallow: /meals/*/apply', 'Disallow: /meals/*/status', 'Disallow: /meals/*/host', 'Disallow: /meals/*/edit', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
}

export function sitemapXml(origin: string, meals: ReadonlyArray<{ id: string; title: string }>): string {
  const urls = ['/', '/discover', ...meals.map(mealPath)];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(origin + u)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
