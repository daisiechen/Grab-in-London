import { describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useSession } from './session.tsx';
import { useApi } from './ApiProvider.tsx';
import { createFetchStub, deferred, fail, noContent, ok, type StubResponse } from '../test/fetchStub.ts';
import { renderWithProviders } from '../test/render.tsx';
import { session } from '../test/fixtures.ts';
import { loadDraft, saveDraft } from '../lib/drafts.ts';

function Probe() {
  const { state, signOut, refresh } = useSession();
  const { cache } = useApi();
  return (
    <div>
      <p data-testid="status">{state.status}{state.status === 'signed-in' ? `:${state.session.user.displayName}` : ''}</p>
      <p data-testid="cache">{cache.size}</p>
      <button onClick={() => cache.set('private:x', 1)}>fill cache</button>
      <button onClick={() => void signOut()}>sign out</button>
      <button onClick={() => void refresh()}>refresh</button>
    </div>
  );
}

describe('SessionProvider', () => {
  it('signs in from GET /auth/session and sends the CSRF token on writes', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), logout: () => noContent() });
    renderWithProviders(<Probe />, stub.fetch);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-in:Sam Rivera'));
    await userEvent.click(screen.getByText('sign out'));
    const logout = stub.callsTo('logout')[0]!;
    expect(logout.headers['x-csrf-token']).toBe('csrf-token-0123456789');
    expect((logout.body as { clientRequestId: string }).clientRequestId).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('guest'));
  });

  it('treats 401 from getSession as a guest and keeps a guest’s drafts for sign-in', async () => {
    saveDraft('apply:m1', { intro: 'typed before signing in' });
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED') });
    renderWithProviders(<Probe />, stub.fetch);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('guest'));
    expect(loadDraft('apply:m1')).toEqual({ intro: 'typed before signing in' });
  });

  it('a network failure while re-checking does not sign a signed-in user out', async () => {
    let n = 0;
    const stub = createFetchStub({ getSession: () => (++n === 1 ? ok(session()) : fail(503, 'PROVIDER_UNAVAILABLE')) });
    renderWithProviders(<Probe />, stub.fetch);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-in:Sam Rivera'));
    saveDraft('create', { title: 'kept' });
    await userEvent.click(screen.getByText('refresh'));
    await waitFor(() => expect(stub.callsTo('getSession').length).toBeGreaterThanOrEqual(2));
    expect(screen.getByTestId('status').textContent).toBe('signed-in:Sam Rivera');
    expect(loadDraft('create')).toEqual({ title: 'kept' });
  });

  it('ignores a getSession response that arrives after logout (auth generation)', async () => {
    const first = deferred<StubResponse>();
    const late = deferred<StubResponse>();
    let n = 0;
    const stub = createFetchStub({
      getSession: () => (++n === 1 ? first.promise : late.promise),
      logout: () => noContent(),
    });
    renderWithProviders(<Probe />, stub.fetch);
    await act(async () => { first.resolve(ok(session())); });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-in:Sam Rivera'));

    await userEvent.click(screen.getByText('refresh')); // in flight, unresolved
    await userEvent.click(screen.getByText('sign out'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('guest'));

    await act(async () => { late.resolve(ok(session())); });
    expect(screen.getByTestId('status').textContent).toBe('guest');
    // The stale response must not have restored the CSRF token either: the next write carries none.
    expect(stub.callsTo('getSession')).toHaveLength(2);
  });

  it('clears caches and drafts on logout even when the server call fails', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), logout: () => fail(503, 'PROVIDER_UNAVAILABLE') });
    renderWithProviders(<Probe />, stub.fetch);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-in:Sam Rivera'));
    saveDraft('apply:m1', { intro: 'hello there' });
    await userEvent.click(screen.getByText('fill cache'));
    await userEvent.click(screen.getByText('refresh'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-in:Sam Rivera'));
    await userEvent.click(screen.getByText('sign out'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('guest'));
    expect(loadDraft('apply:m1')).toBeNull();
    expect(screen.getByTestId('cache').textContent).toBe('0');
  });

  it('a 401 from any call clears the session and private state', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), getMe: () => fail(401, 'AUTH_REQUIRED') });
    function Caller() {
      const { api } = useApi();
      return <button onClick={() => void api.client.call('getMe', {}).catch(() => {})}>load me</button>;
    }
    renderWithProviders(<><Probe /><Caller /></>, stub.fetch);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-in:Sam Rivera'));
    saveDraft('create', { title: 'x' });
    await userEvent.click(screen.getByText('load me'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('guest'));
    expect(loadDraft('create')).toBeNull();
  });
});
