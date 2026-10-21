import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';
import { App } from '../app/App.tsx';
import { createWebApi, type WebApi } from '../api/webApi.ts';
import { ApiProvider } from '../api/ApiProvider.tsx';
import { SessionProvider } from '../api/session.tsx';
import { ToastProvider } from '../ui/toast.tsx';

/** Retries never sleep in tests. */
export const testApi = (fetchImpl: typeof fetch): WebApi =>
  createWebApi({ fetch: fetchImpl, baseUrl: 'http://web.test', retry: { sleep: async () => {} } });

export function renderApp(fetchImpl: typeof fetch, path = '/discover') {
  const api = testApi(fetchImpl);
  return { api, ...render(<MemoryRouter initialEntries={[path]}><App api={api} /></MemoryRouter>) };
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
