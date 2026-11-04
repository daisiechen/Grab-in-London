import { Component, lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';

export type LazyPage<P extends object> = LazyExoticComponent<ComponentType<P>> & { preload: () => Promise<void> };

/**
 * Route-level code splitting: the page's group chunk (app/pages/*.ts) loads on the first visit
 * while the route's Suspense boundary shows <PageLoading />. Once a page is loaded, by a visit
 * or by preload(), React gets an already-resolved thenable, so later renders are synchronous and
 * never flash the loading state. preload() retries after a failed download; a page whose
 * render-time load failed shows PageLoadBoundary's reload prompt.
 */
export function lazyPage<M, P extends object = object>(load: () => Promise<M>, pick: (module: M) => ComponentType<P>): LazyPage<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  const preload = () =>
    (pending ??= load().then(
      (module) => (loaded = pick(module)),
      (error: unknown) => { pending = null; throw error; },
    ));
  const page = lazy<ComponentType<P>>(() => {
    const ready = loaded;
    // A thenable that resolves synchronously lets React render a preloaded page without suspending.
    if (ready) return { then: (resolve: (m: { default: ComponentType<P> }) => void) => resolve({ default: ready }) } as unknown as Promise<{ default: ComponentType<P> }>;
    return preload().then((c) => ({ default: c }));
  });
  return Object.assign(page, { preload: () => preload().then(() => undefined) });
}

/** Suspense fallback while a page chunk downloads: announced politely, shown after a short delay. */
export function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>Loading page…</span>
    </div>
  );
}

/**
 * A page chunk that fails to download (offline, or an old tab after a deploy replaced the build)
 * shows a way out instead of a blank screen. Navigating to another path clears it.
 */
export class PageLoadBoundary extends Component<{ path: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidUpdate(prev: { path: string }): void {
    if (this.state.failed && prev.path !== this.props.path) this.setState({ failed: false });
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page-loading" role="alert">
        <p>This page couldn’t load. Check your connection, then reload.</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}
