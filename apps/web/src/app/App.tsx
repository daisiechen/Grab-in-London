import { AssistantProvider, AssistantLauncher, AssistantPanel } from '../features/assistant/index.ts';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { ApiProvider } from '../api/ApiProvider.tsx';
import { SessionProvider } from '../api/session.tsx';
import type { WebApi } from '../api/webApi.ts';
import { ToastProvider } from '../ui/toast.tsx';
import { BottomNav } from './BottomNav.tsx';
import { NotFound } from './NotFound.tsx';
import { appRoutes } from './routes.tsx';
import { TelemetryProvider } from '../api/telemetry.tsx';
import { AnalyticsConsent } from '../features/settings/AnalyticsConsent.tsx';

/** Top-level tabs show the bottom nav; focused flows (sign-in, apply, chat) do not. */
const NAV_PATHS = [/^\/discover$/, /^\/meals$/, /^\/inbox$/, /^\/profile$/];

function Shell() {
  const location = useLocation();
  const withNav = NAV_PATHS.some((re) => re.test(location.pathname));
  return (
    <div className="app">
      <AnalyticsConsent />
      <main className={`app-main${withNav ? '' : ' no-nav'}`}>
        <Routes>
          <Route path="/" element={<Navigate to="/discover" replace />} />
          {appRoutes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {withNav && <BottomNav />}
      <AssistantLauncher />
      <AssistantPanel />
    </div>
  );
}

/** Providers without a router, so tests can wrap with MemoryRouter and main.tsx with BrowserRouter. */
export function App({ api }: { api: WebApi }) {
  return (
    <ApiProvider api={api}>
      <SessionProvider>
        <ToastProvider>
          <TelemetryProvider><AssistantProvider><Shell /></AssistantProvider></TelemetryProvider>
        </ToastProvider>
      </SessionProvider>
    </ApiProvider>
  );
}
