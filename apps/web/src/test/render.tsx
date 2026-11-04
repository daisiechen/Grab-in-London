import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';
import { App } from '../app/App.tsx';
import { AnalyticsConsent } from '../features/settings/AnalyticsConsent.tsx';
import { createWebApi, type WebApi } from '../api/webApi.ts';
import { ApiProvider } from '../api/ApiProvider.tsx';
import { SessionProvider } from '../api/session.tsx';
import { ToastProvider } from '../ui/toast.tsx';
import { PollerDepsContext } from '../lib/pollerContext.tsx';
import type { PollerDeps } from '../lib/poller.ts';

/** Retries never sleep in tests. */
export const testApi = (fetchImpl: typeof fetch): WebApi =>
  createWebApi({ fetch: fetchImpl, baseUrl: 'http://web.test', retry: { sleep: async () => {} } });

export function renderApp(fetchImpl: typeof fetch, path = '/discover', options: { pollerDeps?: PollerDeps; consentControl?: boolean } = {}) {
  const api = testApi(fetchImpl);
  const app = <MemoryRouter initialEntries={[path]}><App api={api} {...(options.consentControl ? { extra: <AnalyticsConsent /> } : {})} /></MemoryRouter>;
  const deps = options.pollerDeps;
  return { api, ...render(deps ? <PollerDepsContext.Provider value={() => deps}>{app}</PollerDepsContext.Provider> : app) };
}

export function renderWithProviders(ui: ReactElement, fetchImpl: typeof fetch, path = '/') {
  const api = testApi(fetchImpl);
  return {
    api,
    ...render(
      <MemoryRouter initialEntries={[path]}>
        <ApiProvider api={api}><SessionProvider><ToastProvider>{ui}</ToastProvider></SessionProvider></ApiProvider>
      </MemoryRouter>,
    ),
  };
}
