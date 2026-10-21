import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';
import { createAdminApi } from './api/admin-api.ts';
import { fail, list, mockFetch, ok, pageData, session, SNAP_A, SNAP_B, snapshot } from './test/mock-api.ts';

const A = snapshot(SNAP_A, '2026-10-18T12:00:00Z');
const B = snapshot(SNAP_B, '2026-10-19T12:00:00Z');

function setup(routes: Parameters<typeof mockFetch>[0], url = '/?lang=zh#overview') {
  history.replaceState(null, '', url);
  const mock = mockFetch(routes);
  render(<App api={createAdminApi({ fetch: mock.fetch })} />);
  return mock;
}

const baseRoutes = (snapshots = [A]) => ({
  'GET /v1/auth/session': () => ok(session()),
  'GET /v1/admin/snapshots': () => list(snapshots),
  'GET /v1/admin/(overview|journey|supply|retention|quality)': (c: { path: string }) =>
    ok(pageData(c.path.split('/').pop()!, snapshots.find((s) => s.id === new URL(location.href).searchParams.get('snapshot')) ?? A)),
});

describe('admin shell', () => {
  it('shows exactly the five existing pages and binds the page request to one snapshot + canonical filters', async () => {
    const mock = setup(baseRoutes(), '/?lang=zh&languages=zh&sizes=2#supply');
    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['#overview', '#journey', '#supply', '#retention', '#quality']);
    await screen.findByLabelText('页面内容');
    const call = mock.calls.find((c) => c.path === '/v1/admin/supply')!;
    expect(call.query.get('snapshotId')).toBe(SNAP_A);
    expect(call.query.get('from')).toBe('2026-09-21');
    expect(call.query.get('to')).toBe('2026-10-18');
    expect(call.query.get('languages')).toBe('zh');
    expect(call.query.get('sizes')).toBe('2');
    expect(new URL(location.href).searchParams.get('snapshot')).toBe(SNAP_A);
  });

  it('keeps filters and page in the URL when switching language', async () => {
    setup(baseRoutes(), '/?lang=zh&budgetBands=20-30#retention');
    await screen.findByLabelText('页面内容');
    await userEvent.click(screen.getByRole('button', { name: '切换为英文' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Experience & retention');
    const params = new URL(location.href).searchParams;
    expect(params.get('lang')).toBe('en');
    expect(params.get('budgetBands')).toBe('20-30');
    expect(location.hash).toBe('#retention');
    expect(screen.getByRole('button', { name: 'Remove filter: Budget' }).textContent).toContain('> £20–30');
  });

  it('offers area/source options from the pinned snapshot and sends their codes', async () => {
    const mock = setup(baseRoutes(), '/?lang=en#overview');
    await screen.findByLabelText('Page content');
    const areas = screen.getByRole('group', { name: 'Area' });
    expect(within(areas).getAllByRole('checkbox').map((c) => c.parentElement!.textContent)).toEqual(['All areas', 'Soho', "King's Cross"]);
    await userEvent.click(within(areas).getByLabelText("King's Cross"));
    await waitFor(() => expect(mock.calls.filter((c) => c.path === '/v1/admin/overview').at(-1)!.query.get('areas')).toBe('kings-cross'));
    expect(screen.getByRole('button', { name: 'Remove filter: Area' }).textContent).toContain("King's Cross");
  });

  it('sends a legacy ≤ £25 link as budgetUpToPence; choosing bands replaces it', async () => {
    const mock = setup(baseRoutes(), '/?lang=en&budget=25#overview');
    await screen.findByLabelText('Page content');
    const first = mock.calls.find((c) => c.path === '/v1/admin/overview')!;
    expect(first.query.get('budgetUpToPence')).toBe('2500');
    expect(first.query.get('budgetBands')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(within(screen.getByRole('group', { name: 'Budget / person' })).getByLabelText('£0–20'));
    await waitFor(() => expect(mock.calls.filter((c) => c.path === '/v1/admin/overview').at(-1)!.query.get('budgetBands')).toBe('0-20'));
    expect(mock.calls.filter((c) => c.path === '/v1/admin/overview').at(-1)!.query.get('budgetUpToPence')).toBeNull();
    expect(new URL(location.href).searchParams.get('budget')).toBeNull();
  });

  it('applies dates only on Apply and rejects an end after the snapshot', async () => {
    const mock = setup(baseRoutes());
    await screen.findByLabelText('页面内容');
    const end = screen.getByLabelText('结束日期');
    fireEvent.change(end, { target: { value: '2026-10-19' } });
    expect(screen.getByText('日期尚未应用，图表仍使用上次范围。')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(screen.getByRole('alert').textContent).toContain('结束日期不得晚于快照');
    expect(mock.calls.filter((c) => c.path === '/v1/admin/overview')).toHaveLength(1);
    fireEvent.change(end, { target: { value: '2026-10-10' } });
    await userEvent.click(screen.getByRole('button', { name: '应用' }));
    await waitFor(() => expect(mock.calls.filter((c) => c.path === '/v1/admin/overview').at(-1)!.query.get('to')).toBe('2026-10-10'));
  });

  it('401 shows a sign-in prompt and no data surfaces', async () => {
    const mock = setup({ 'GET /v1/auth/session': () => fail(401, 'AUTH_REQUIRED') });
    expect((await screen.findByRole('alert')).textContent).toContain('请重新登录');
    expect(screen.queryByLabelText('全局筛选')).toBeNull();
    expect(mock.calls.some((c) => c.path.startsWith('/v1/admin/'))).toBe(false);
  });

  it('403 on the snapshot list shows no-access without data', async () => {
    setup({ 'GET /v1/auth/session': () => ok(session([])), 'GET /v1/admin/snapshots': () => fail(403, 'FORBIDDEN') });
    expect((await screen.findByRole('alert')).textContent).toContain('没有访问权限');
    expect(screen.queryByLabelText('页面内容')).toBeNull();
  });

  it('410 clears the page, drops the snapshot from the URL and asks for a new one', async () => {
    let revoked = false;
    const mock = setup({
      'GET /v1/auth/session': () => ok(session()),
      'GET /v1/admin/snapshots': () => list(revoked ? [{ ...B, status: 'REVOKED' }, A] : [B, A]),
      'GET /v1/admin/overview': (c) => {
        if (c.query.get('snapshotId') === SNAP_B) { revoked = true; return fail(410, 'SNAPSHOT_REVOKED'); }
        return ok(pageData('overview', A));
      },
    });
    const picker = await screen.findByRole('dialog');
    expect(within(picker).getByRole('alert').textContent).toContain('撤销');
    expect(screen.queryByLabelText('页面内容')).toBeNull();
    expect(new URL(location.href).searchParams.get('snapshot')).toBeNull();
    await waitFor(() => expect(within(picker).getAllByRole('button').some((b) => b.textContent?.includes('已撤销') && (b as HTMLButtonElement).disabled)).toBe(true));
    const sealed = within(picker).getAllByRole('button').find((b) => b.textContent?.includes(SNAP_A))!;
    await userEvent.click(sealed);
    await screen.findByLabelText('页面内容');
    expect(mock.calls.filter((c) => c.path === '/v1/admin/overview').at(-1)!.query.get('snapshotId')).toBe(SNAP_A);
  });

  it('keeps the bound snapshot when a newer one exists and switches only on request', async () => {
    const mock = setup(baseRoutes([A, B]), `/?lang=zh&snapshot=${SNAP_A}#overview`);
    await screen.findByLabelText('页面内容');
    expect(mock.calls.filter((c) => c.path === '/v1/admin/overview').every((c) => c.query.get('snapshotId') === SNAP_A)).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: '切换到新快照' }));
    await waitFor(() => expect(mock.calls.filter((c) => c.path === '/v1/admin/overview').at(-1)!.query.get('snapshotId')).toBe(SNAP_B));
  });

  it('shows "no snapshot" without numbers when none is sealed', async () => {
    setup(baseRoutes([]));
    expect(await screen.findByText('暂无可用快照')).toBeTruthy();
  });

  it('metric dictionary dialog closes on Escape and returns focus to its trigger', async () => {
    setup(baseRoutes(), '/?lang=en#quality');
    await screen.findByLabelText('Page content');
    const trigger = screen.getAllByRole('button').find((b) => b.textContent?.includes('14-day first attendance'))!;
    trigger.focus();
    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Calculation');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
