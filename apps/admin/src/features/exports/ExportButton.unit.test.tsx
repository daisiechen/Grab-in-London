import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@fancy/client';
import { createAdminApi, type AdminApi, type ExportTicket } from '../../api/admin-api.ts';
import { ConsoleProvider, useConsole } from '../../state/console.tsx';
import { parseSearch } from '../../state/filters.ts';
import { list, mockFetch, ok, pageData, session, snapshot, SNAP_A, HASH } from '../../test/mock-api.ts';
import { ExportButton } from './ExportButton.tsx';

const filters = parseSearch('').filters;
const snap = snapshot(SNAP_A, '2026-10-18T12:00:00Z');
const TICKET: ExportTicket = { exportId: '55555555-5555-4555-8555-555555555555', snapshotId: SNAP_A, expiresAt: '2026-10-18T13:10:00Z' };

function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function Probe({ showExport, area }: { showExport: boolean; area: string | null }) {
  const c = useConsole();
  const binding = c.binding && { ...c.binding, filterHash: c.binding.filterHash ?? HASH };
  return (
    <div>
      <button onClick={() => c.reportFailure(new ApiError({ status: 410, code: 'SNAPSHOT_REVOKED', message: 'revoked' }))}>revoke</button>
      <button onClick={() => c.reportFailure(new ApiError({ status: 401, code: 'AUTH_REQUIRED', message: 'signed out' }))}>signout</button>
      {showExport && <ExportButton scope="summary.overview" binding={binding} rows={area ? { q: area } : {}} t={(_zh, en) => en} />}
    </div>
  );
}

function setup(api: AdminApi) {
  let hide!: () => void; let changeRows!: (q: string) => void;
  function Harness() {
    const [id, setId] = useState<string | null>(SNAP_A);
    const [shown, setShown] = useState(true);
    const [area, setArea] = useState<string | null>(null);
    hide = () => setShown(false); changeRows = setArea;
    return <ConsoleProvider api={api} page="overview" filters={filters} snapshotId={id} onSnapshotChange={setId}><Probe showExport={shown} area={area} /></ConsoleProvider>;
  }
  render(<Harness />);
  return { hide: () => act(hide), changeRows: (q: string) => act(() => changeRows(q)) };
}

function makeApi() {
  const mock = mockFetch({ 'GET /v1/auth/session': () => ok(session()), 'GET /v1/admin/snapshots': () => list([snap]), 'GET /v1/admin/overview': () => ok(pageData('overview', snap)) });
  const api = createAdminApi({ fetch: mock.fetch });
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:synthetic'), revokeObjectURL: vi.fn() });
  const save = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return { api, save };
}
const exportButton = () => screen.findByRole('button', { name: 'Export metrics' });
const ready = async () => { await waitFor(async () => expect((await exportButton()).hasAttribute('disabled')).toBe(false)); };

describe('P10-R01 export completions are fenced to their scope', () => {
  it('saves a normal export exactly once with a success notice', async () => {
    const { api, save } = makeApi();
    api.createExport = vi.fn(async () => TICKET); api.downloadExport = vi.fn(async () => 'a,b\r\n');
    setup(api); await ready();
    await userEvent.click(await exportButton());
    await screen.findByRole('status');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('drops a late ticket after 410: no download request, no save, no notice', async () => {
    const { api, save } = makeApi();
    const ticket = deferred<ExportTicket>();
    api.createExport = vi.fn(() => ticket.promise); api.downloadExport = vi.fn(async () => 'a,b\r\n');
    setup(api); await ready();
    await userEvent.click(await exportButton());
    await userEvent.click(screen.getByRole('button', { name: 'revoke' }));
    await act(async () => { ticket.resolve(TICKET); await ticket.promise; });
    expect(api.downloadExport).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('drops a late CSV after 401 sign-out', async () => {
    const { api, save } = makeApi();
    const csv = deferred<string>();
    api.createExport = vi.fn(async () => TICKET); api.downloadExport = vi.fn(() => csv.promise);
    setup(api); await ready();
    await userEvent.click(await exportButton());
    await waitFor(() => expect(api.downloadExport).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'signout' }));
    await act(async () => { csv.resolve('private\r\n'); await csv.promise; });
    expect(save).not.toHaveBeenCalled();
  });

  it('drops a late CSV after the control unmounts without any scope change', async () => {
    const { api, save } = makeApi();
    const csv = deferred<string>();
    api.createExport = vi.fn(async () => TICKET); api.downloadExport = vi.fn(() => csv.promise);
    const h = setup(api); await ready();
    await userEvent.click(await exportButton());
    await waitFor(() => expect(api.downloadExport).toHaveBeenCalledTimes(1));
    h.hide();
    await act(async () => { csv.resolve('private\r\n'); await csv.promise; });
    expect(save).not.toHaveBeenCalled();
  });

  it('a late failure of a superseded scope does not revoke or sign out the current one', async () => {
    const { api } = makeApi();
    const csv = deferred<string>();
    api.createExport = vi.fn(async () => TICKET); api.downloadExport = vi.fn(() => csv.promise);
    const h = setup(api); await ready();
    const report = vi.fn();
    await userEvent.click(await exportButton());
    await waitFor(() => expect(api.downloadExport).toHaveBeenCalledTimes(1));
    h.hide();
    await act(async () => { csv.reject(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'late' })); await csv.promise.catch(report); });
    expect(screen.getByRole('button', { name: 'revoke' })).toBeTruthy(); // console still rendered, no gate failure
  });

  it('cancels when the binding changes in flight and says so instead of saving', async () => {
    const { api, save } = makeApi();
    const csv = deferred<string>();
    api.createExport = vi.fn(async () => TICKET); api.downloadExport = vi.fn(() => csv.promise);
    const h = setup(api); await ready();
    await userEvent.click(await exportButton());
    await waitFor(() => expect(api.downloadExport).toHaveBeenCalledTimes(1));
    h.changeRows('other');
    await act(async () => { csv.resolve('a\r\n'); await csv.promise; });
    expect(save).not.toHaveBeenCalled();
    expect((await screen.findByRole('alert')).textContent).toContain('export was cancelled');
  });

  it('reuses the key only for the identical intent after a network error', async () => {
    const { api } = makeApi();
    const keys: string[] = [];
    api.createExport = vi.fn(async (_input, key?: string) => { keys.push(key!); throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' }); });
    const h = setup(api); await ready();
    await userEvent.click(await exportButton());
    await waitFor(async () => expect((await exportButton()).hasAttribute('disabled')).toBe(false));
    await userEvent.click(await exportButton());
    await waitFor(() => expect(keys).toHaveLength(2));
    h.changeRows('other');
    await userEvent.click(await exportButton());
    await waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });
});
