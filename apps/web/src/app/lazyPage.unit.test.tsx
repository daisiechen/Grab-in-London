import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { lazyPage, PageLoadBoundary, PageLoading } from './lazyPage.tsx';
import { appRoutes } from './routes.tsx';

const LAZY = Symbol.for('react.lazy');
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const mount = (Page: ReturnType<typeof lazyPage>, path = '/x') =>
  render(<PageLoadBoundary path={path}><Suspense fallback={<PageLoading />}><Page /></Suspense></PageLoadBoundary>);

describe('route-level code splitting', () => {
  it('shows an announced loading state until the page chunk arrives, then the page', async () => {
    const chunk = deferred<{ Page: () => React.JSX.Element }>();
    const Page = lazyPage(() => chunk.promise, (m) => m.Page);
    mount(Page);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Loading page…');
    expect(status.getAttribute('aria-live')).toBe('polite');
    await act(async () => { chunk.resolve({ Page: () => <h1>Loaded page</h1> }); });
    expect(screen.getByRole('heading', { name: 'Loaded page' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders a preloaded page without a loading state, loading its chunk once', async () => {
    const load = vi.fn(async () => ({ Page: () => <h1>Ready</h1> }));
    const Page = lazyPage(load, (m) => m.Page);
    await Page.preload();
    await Page.preload();
    mount(Page);
    expect(screen.getByRole('heading', { name: 'Ready' })).toBeTruthy();
    expect(screen.queryByText('Loading page…')).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a chunk that fails to download offers a reload instead of a blank page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const chunk = deferred<{ Page: () => React.JSX.Element }>();
    const Page = lazyPage(() => chunk.promise, (m) => m.Page);
    mount(Page);
    await act(async () => { chunk.reject(new TypeError('Failed to fetch dynamically imported module')); });
    expect(screen.getByRole('alert').textContent).toContain('This page couldn’t load. Check your connection, then reload.');
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeTruthy();
  });

  it('preload() tries again after a failed download', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ Page: () => <h1>Back online</h1> });
    const Page = lazyPage(load as () => Promise<{ Page: () => React.JSX.Element }>, (m) => m.Page);
    await expect(Page.preload()).rejects.toThrow('offline');
    await Page.preload();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('every page except the home page, Get the app and legal redirects is split out of the entry chunk', () => {
    const eager = appRoutes.filter((r) => (r.element.type as { $$typeof?: symbol }).$$typeof !== LAZY).map((r) => r.path);
    expect(eager.filter((p) => !['/', '/get-app'].includes(p)).every((p) => ['/privacy', '/terms', '/guidelines', '/support'].includes(p))).toBe(true);
    for (const path of ['/discover', '/meals/:mealId/:slug', '/sign-in', '/create', '/inbox', '/chat/:conversationId', '/profile', '/settings', '/post-meal/:mealId']) {
      expect((appRoutes.find((r) => r.path === path)!.element.type as { $$typeof?: symbol }).$$typeof, path).toBe(LAZY);
    }
  });
});
