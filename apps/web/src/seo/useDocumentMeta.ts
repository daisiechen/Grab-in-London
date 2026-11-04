import { useEffect } from 'react';
import { SITE_ORIGIN } from './meal-seo.ts';

export interface DocumentMeta {
  title: string;
  description?: string;
  /** `noindex` pages: profiles, account pages, closed meals. */
  robots?: 'index' | 'noindex' | 'noindex, nofollow';
  /** Site-relative canonical path. */
  canonical?: string;
}

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.append(el); }
  el.content = content;
}

/**
 * Keeps the document head in step with the page for people and for crawlers that run JavaScript.
 * Link-preview bots that don't run scripts get the same tags from the meta server (apps/web/server).
 */
export function useDocumentMeta(meta: DocumentMeta | null) {
  const { title, description, robots, canonical } = meta ?? { title: '' };
  useEffect(() => {
    if (!title) return;
    document.title = title;
    setMeta('name', 'description', description ?? null);
    setMeta('name', 'robots', robots && robots !== 'index' ? robots : null);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description ?? null);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.append(link); }
      link.href = SITE_ORIGIN + canonical;
      setMeta('property', 'og:url', SITE_ORIGIN + canonical);
    } else {
      link?.remove();
      setMeta('property', 'og:url', null);
    }
  }, [title, description, robots, canonical]);
}
