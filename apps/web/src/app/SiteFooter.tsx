import { Link } from 'react-router';

/** Site footer: on the homepage everywhere, on other public pages from tablet width (spec §5 首页). */
export function SiteFooter({ publicOnly = false }: { publicOnly?: boolean }) {
  return (
    <footer className={`sitefoot${publicOnly ? ' public-only' : ''}`}>
      <span className="wordmark" style={{ fontSize: 18 }}>Fancy</span>
      <nav className="cols" aria-label="Site">
        <Link to="/discover">Discover meals</Link>
        <Link to="/get-app">Get the app</Link>
        <a href="/guidelines/">Community guidelines</a>
        <a href="/privacy/">Privacy</a>
        <a href="/terms/">Terms</a>
        <a href="/privacy/#cookies-and-storage-on-your-device">Cookies</a>
        <a href="/support/">Help &amp; contact</a>
      </nav>
      <p>Meet new people over a meal. London · Adults 18+ · © 2026 Fancy</p>
    </footer>
  );
}
