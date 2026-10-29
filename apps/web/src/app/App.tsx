import { useEffect, useRef, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { ApiProvider } from '../api/ApiProvider.tsx';
import { SessionProvider } from '../api/session.tsx';
import type { WebApi } from '../api/webApi.ts';
import { ToastProvider } from '../ui/toast.tsx';
import { BottomNav, TopNav } from './BottomNav.tsx';
import { SiteFooter } from './SiteFooter.tsx';
import { NotFound } from './NotFound.tsx';
import { appRoutes } from './routes.tsx';
import { TelemetryProvider } from '../api/telemetry.tsx';
import { AnalyticsConsentSheet } from '../features/settings/AnalyticsConsent.tsx';
import { captureArrival } from '../lib/attribution.ts';
import { AssistantProvider } from '../features/assistant/index.ts';

/** Top-level tabs show the phone tab bar (iOS (tabs) group); focused flows do not. */
const TAB_PATHS = [/^\/discover$/, /^\/meals$/, /^\/inbox$/, /^\/profile$/];
/** Pages laid out on the 1120px desktop grid rather than the 720px reading column. */
const WIDE_PATHS = [/^\/meals\/[^/]+\/host$/, /^\/post-meal\/[^/]+$/, /^\/discover$/, /^\/meals\/[^/]+(\/(?!(apply|status|host|edit)$)[^/]+)?$/, /^\/profiles\/[^/]+$/, /^\/sign-in$/];
/** Public pages that carry the site footer on tablet and desktop. */
const PUBLIC_PATHS = [/^\/discover$/, /^\/meals\/[^/]+(\/(?!(apply|status|host|edit)$)[^/]+)?$/, /^\/profiles\/[^/]+$/, /^\/get-app$/];
const NO_CHROME = [/^\/sign-in/, /^\/auth\/callback$/];

/** Old web paths (before the routes matched iOS) keep working for bookmarks and sent emails. */
function LegacyRedirect({ to }: { to: (params: Record<string, string | undefined>) => string }) {
  const params = useParams();
  const { search } = useLocation();
  return <Navigate to={to(params) + search} replace />;
}

function Shell({ extra }: { extra?: ReactNode }) {
  const location = useLocation();
  const path = location.pathname;
  const tabs = TAB_PATHS.some((re) => re.test(path));
  const wide = WIDE_PATHS.some((re) => re.test(path));
  const home = path === '/';
  const chrome = !NO_CHROME.some((re) => re.test(path));
  const main = useRef<HTMLElement>(null);
  const first = useRef(true);
  useEffect(() => { captureArrival(window.location.href); }, []);
  // Route changes move focus to the page (and scroll to the top), so keyboard and screen-reader
  // users start at the new content instead of the link they activated.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [path]);
  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      {chrome && <TopNav />}
      <AnalyticsConsentSheet />
      {extra}
      <main id="main" ref={main} tabIndex={-1} className={['app-main', tabs ? 'with-tabs' : '', wide ? 'wide' : '', home ? 'full' : ''].filter(Boolean).join(' ')}>
        <Routes>
          {appRoutes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
          <Route path="/inbox/:conversationId" element={<LegacyRedirect to={(p) => `/chat/${p.conversationId}`} />} />
          <Route path="/inbox/notifications" element={<LegacyRedirect to={() => '/notifications'} />} />
          <Route path="/profile/edit" element={<LegacyRedirect to={() => '/profile-edit'} />} />
          <Route path="/settings/deletion" element={<LegacyRedirect to={() => '/delete-account'} />} />
          <Route path="/settings/survey" element={<LegacyRedirect to={() => '/survey'} />} />
          <Route path="/create/terms" element={<LegacyRedirect to={() => '/cancellation-terms'} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {home ? <SiteFooter /> : PUBLIC_PATHS.some((re) => re.test(path)) ? <SiteFooter publicOnly /> : null}
      {tabs && <BottomNav />}
    </div>
  );
}

/** Providers without a router, so tests can wrap with MemoryRouter and main.tsx with BrowserRouter. */
/** `extra` renders above the page (tests mount the analytics control there). */
export function App({ api, extra }: { api: WebApi; extra?: ReactNode }) {
  return (
    <ApiProvider api={api}>
      <SessionProvider>
        <ToastProvider>
          {/* Ask Fancy stays off this release (iOS ASSISTANT_ENABLED = false): the provider only backs editors not yet migrated. */}
          <TelemetryProvider><AssistantProvider><Shell extra={extra} /></AssistantProvider></TelemetryProvider>
        </ToastProvider>
      </SessionProvider>
    </ApiProvider>
  );
}
