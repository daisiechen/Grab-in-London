import { SITE_NAME, SITE_ORIGIN } from './meal-seo.ts';

/*
 * HTML head fragment for link-preview bots and crawlers (spec §8). Pure string work, shared by the
 * meta server and its tests; every value is escaped, and JSON-LD is serialised so `</script>`
 * inside a title can never close the tag.
 */

export interface HeadInput {
  title: string;
  description?: string | undefined;
  robots?: 'index' | 'noindex' | 'noindex, nofollow' | undefined;
  /** Site-relative canonical path. */
  canonical?: string | undefined;
  jsonLd?: Record<string, unknown> | undefined;
  origin?: string | undefined;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/** Generic share image (brand artwork) until a per-meal text card exists (API gap, spec §11). */
export const SHARE_IMAGE = '/images/brand-table.jpg';

export function renderHead({ title, description, robots = 'index', canonical, jsonLd, origin = SITE_ORIGIN }: HeadInput): string {
  const tags = [`<title>${esc(title)}</title>`];
  if (description) tags.push(`<meta name="description" content="${esc(description)}">`);
  if (robots !== 'index') tags.push(`<meta name="robots" content="${robots}">`);
  if (canonical) tags.push(`<link rel="canonical" href="${esc(origin + canonical)}">`);
  tags.push(
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:type" content="${jsonLd ? 'article' : 'website'}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:image" content="${esc(origin + SHARE_IMAGE)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  );
  if (description) tags.push(`<meta property="og:description" content="${esc(description)}">`);
  if (canonical) tags.push(`<meta property="og:url" content="${esc(origin + canonical)}">`);
  if (jsonLd) tags.push(`<script type="application/ld+json">${safeJson(jsonLd)}</script>`);
  return tags.join('\n    ');
}

/** Replaces the built index.html's `<title>` with the page head. */
export function injectHead(indexHtml: string, head: string): string {
  return indexHtml.replace(/<title>[\s\S]*?<\/title>/, head);
}
