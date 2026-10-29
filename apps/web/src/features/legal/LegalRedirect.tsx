import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * The legal pages are static files (public/<page>/index.html, built by scripts/build_legal_pages.py).
 * A host that serves them at /<page>/ but falls back to this app for /<page> lands here: hand the
 * browser over to the static page instead of showing “not on the menu”. If the app is reached at
 * /<page>/ itself, the static file is missing on this host, so show a link instead of looping.
 */
export const LEGAL_PATHS = ['/privacy', '/terms', '/guidelines', '/support'] as const;

export function LegalRedirect({ path, navigate = (url) => window.location.replace(url) }: { path: (typeof LEGAL_PATHS)[number]; navigate?: (url: string) => void }) {
  const { pathname } = useLocation();
  const target = `${path}/`;
  const shouldRedirect = pathname === path;
  useEffect(() => { if (shouldRedirect) navigate(target); }, [navigate, shouldRedirect, target]);
  return (
    <div className="body-pad empty">
      <p>{shouldRedirect ? 'Opening ' : 'This page is available at '}<a href={target}>fancyabite.uk{target}</a></p>
    </div>
  );
}
