import { describe, expect, it } from 'vitest';
import { meal, MEAL_ID, publicProfile, HOST_ID } from '../test/fixtures.ts';
import type { Meal } from '../api/types.ts';
import { injectHead, renderHead } from './head.ts';
import { mealDescription, mealIndexable, mealJsonLd, mealPath, mealSlug } from './meal-seo.ts';
import { headFor, robotsTxt, sitemapXml, type PageLoaders } from './pages.ts';
import { captureArrival, resetAttribution, signupSource } from '../lib/attribution.ts';

const open = (over: Record<string, unknown> = {}) => meal({
  startsAt: { ...meal().startsAt, instant: '2099-10-23T18:30:00.000Z' },
  closesAt: { ...meal().closesAt, instant: '2099-10-23T17:30:00.000Z' },
  ...over,
}) as Meal;
const loaders = (m: Meal | null): PageLoaders => ({ meal: async () => m, profile: async (id) => (id === HOST_ID ? publicProfile() : null), areaName: () => 'Soho', now: () => Date.parse('2026-10-21T12:00:00Z') });

describe('meal slugs (D5)', () => {
  it('lower-cases, folds accents, drops other scripts and joins words with hyphens', () => {
    expect(mealSlug('Friday dinner & new faces')).toBe('friday-dinner-and-new-faces');
    expect(mealSlug('Café crème — 晚餐 at Noodle House!')).toBe('cafe-creme-at-noodle-house');
    expect(mealSlug('晚餐')).toBe('');
    expect(mealPath({ id: MEAL_ID, title: '晚餐' })).toBe(`/meals/${MEAL_ID}`);
  });
  it('cuts long titles at a word boundary and never collides with a meal sub-page', () => {
    const slug = mealSlug('A very long title about a relaxed supper with new friends near the river on Friday evening');
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
    expect(mealSlug('Apply')).toBe('apply-meal');
    expect(mealSlug('Status')).toBe('status-meal');
  });
});

describe('meal head (§8)', () => {
  it('describes the table without private data and offers only open tables to search engines', () => {
    expect(mealDescription(open(), 'Soho')).toBe('Fri 23 Oct, 19:30 · Dishoom Carnaby, Soho · Table for 4 · £25–40 per person, pay at the restaurant');
    expect(mealIndexable(open(), Date.parse('2026-10-21T12:00:00Z'))).toBe(true);
    expect(mealIndexable(open({ status: 'CANCELLED' }), Date.parse('2026-10-21T12:00:00Z'))).toBe(false);
    expect(mealIndexable(open({ confirmedCount: 4 }), Date.parse('2026-10-21T12:00:00Z'))).toBe(false);
    expect(mealIndexable(meal() as Meal, Date.parse('2026-10-24T12:00:00Z'))).toBe(false);
  });
  it('JSON-LD names Fancy as organiser, has no offers and uses London wall time with offset', () => {
    const ld = mealJsonLd(open(), 'Soho');
    expect(ld).toMatchObject({ '@type': 'Event', startDate: '2026-10-23T19:30:00+01:00', endDate: '2026-10-23T21:30:00+01:00', organizer: { '@type': 'Organization', name: 'Fancy' }, maximumAttendeeCapacity: 4, url: `https://fancyabite.uk/meals/${MEAL_ID}/friday-dinner-and-new-faces` });
    expect(JSON.stringify(ld)).not.toMatch(/offers|Maya/);
  });
  it('escapes every value and keeps a hostile title from closing the JSON-LD script', () => {
    const head = renderHead({ title: '</title><script>x</script>', description: '"quoted" & <b>', jsonLd: { name: '</script><script>alert(1)</script>' } });
    expect(head).toContain('<title>&lt;/title&gt;&lt;script&gt;x&lt;/script&gt;</title>');
    expect(head).toContain('content="&quot;quoted&quot; &amp; &lt;b&gt;"');
    expect(head).not.toContain('</script><script>');
    expect(injectHead('<head><title>Fancy</title></head>', '<title>X</title>')).toBe('<head><title>X</title></head>');
  });
});

describe('server head routing', () => {
  it('301s a stale or missing slug to the canonical URL, keeping the query', async () => {
    expect(await headFor(`/meals/${MEAL_ID}`, '?src=share', loaders(open()))).toEqual({ kind: 'redirect', status: 301, location: `/meals/${MEAL_ID}/friday-dinner-and-new-faces?src=share` });
    expect(await headFor(`/meals/${MEAL_ID}/old-title`, '', loaders(open()))).toMatchObject({ kind: 'redirect', status: 301 });
  });
  it('renders the canonical meal head with JSON-LD, and noindex without JSON-LD once closed', async () => {
    const live = await headFor(`/meals/${MEAL_ID}/friday-dinner-and-new-faces`, '', loaders(open()));
    expect(live).toMatchObject({ kind: 'html', status: 200 });
    expect(live.kind === 'html' && live.head).toContain('application/ld+json');
    const closed = await headFor(`/meals/${MEAL_ID}/friday-dinner-and-new-faces`, '', loaders(open({ status: 'CANCELLED' })));
    expect(closed.kind === 'html' && closed.head).toContain('<meta name="robots" content="noindex">');
    expect(closed.kind === 'html' && closed.head).not.toContain('ld+json');
  });
  it('answers 404 for unknown meals and keeps profiles and account pages out of search', async () => {
    expect(await headFor(`/meals/${MEAL_ID}`, '', loaders(null))).toMatchObject({ kind: 'html', status: 404 });
    const profile = await headFor(`/profiles/${HOST_ID}`, '', loaders(null));
    expect(profile.kind === 'html' && profile.head).toContain('Maya Chen on Fancy');
    expect(profile.kind === 'html' && profile.head).toContain('noindex');
    for (const path of ['/inbox', `/meals/${MEAL_ID}/apply`, '/profile-setup', '/chat/abc', '/meals']) {
      const r = await headFor(path, '', loaders(open()));
      expect(r.kind === 'html' && r.head).toContain('noindex, nofollow');
    }
    const discover = await headFor('/discover', '?dates=2026-10-30', loaders(null));
    expect(discover.kind === 'html' && discover.head).toContain('noindex');
  });
  it('robots.txt disallows account pages but not meal pages; the sitemap lists canonical meal URLs', () => {
    const robots = robotsTxt('https://fancyabite.uk');
    expect(robots).toContain('Disallow: /inbox');
    expect(robots).toContain('Disallow: /meals$');
    expect(robots).not.toMatch(/^Disallow: \/meals\/$/m);
    expect(sitemapXml('https://fancyabite.uk', [{ id: MEAL_ID, title: 'Friday dinner & new faces' }])).toContain(`<loc>https://fancyabite.uk/meals/${MEAL_ID}/friday-dinner-and-new-faces</loc>`);
  });
});

describe('sign-up attribution (memory only)', () => {
  it('captures utm parameters, else a shared meal link, once per visit', () => {
    resetAttribution();
    captureArrival('https://fancyabite.uk/discover?utm_source=instagram&utm_medium=social&utm_campaign=launch');
    expect(signupSource()).toEqual({ utmSource: 'instagram', utmMedium: 'social', utmCampaign: 'launch' });
    captureArrival(`https://fancyabite.uk/meals/${MEAL_ID}`);
    expect(signupSource()).toMatchObject({ utmSource: 'instagram' });
    resetAttribution();
    captureArrival(`https://fancyabite.uk/meals/${MEAL_ID}/friday-dinner-and-new-faces?src=share`);
    expect(signupSource()).toEqual({ entry: 'meal_link' });
    resetAttribution();
    captureArrival('https://fancyabite.uk/');
    expect(signupSource()).toBeNull();
    expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toMatch(/utm|meal_link/);
  });
});
