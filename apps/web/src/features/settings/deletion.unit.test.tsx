import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render.tsx';
import { createFetchStub, fail, ok } from '../../test/fetchStub.ts';
import { session } from '../../test/fixtures.ts';
import { clearAllPrivateState, saveDraft, loadDraft } from '../../lib/drafts.ts';
import { ensureDeletionReceipt, readDeletionReceipt, rememberDeletionStatus } from './deletionReceipt.ts';

const pending = { status: 'PENDING' as const, requestedAt: '2026-10-21T12:00:00Z', completedAt: null };
describe('account deletion', () => {
  it('does not show a previous account receipt as the newly signed-in account deletion state',async()=>{
    const old=ensureDeletionReceipt();rememberDeletionStatus(pending);
    const stub=createFetchStub({getSession:()=>ok(session())});renderApp(stub.fetch,'/settings/deletion');
    await screen.findByRole('button',{name:'Delete my account'});
    expect(screen.queryByText('Your account is blocked from further activity. Removal is queued.')).toBeNull();
    expect(ensureDeletionReceipt()).not.toBe(old);
  });
  it('persists a 256-bit receipt before the destructive request, clears private state, and checks with a body only', async () => {
    saveDraft('profile', { bio: 'private' });
    const stub = createFetchStub({ getSession: () => ok(session()), requestDeletion: c => {
      expect(readDeletionReceipt()).toBe((c.body as { receiptToken: string }).receiptToken);
      return ok(pending, 202);
    }, deletionStatus: () => ok({ ...pending, status: 'COMPLETED' }) });
    renderApp(stub.fetch, '/settings/deletion');
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Delete my account' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('checkbox'));
    await user.click(button);
    await screen.findByText('Your account is blocked from further activity. Removal is queued.');
    expect(loadDraft('profile')).toBeNull();
    expect(readDeletionReceipt()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stub.callsTo('requestDeletion')[0]!.headers['if-match']).toBe('"3"');
    await user.click(screen.getByRole('button', { name: 'Check removal status' }));
    await screen.findByText('Your account removal is complete.');
    expect(stub.callsTo('deletionStatus')[0]!.url.search).toBe('');
    expect(stub.callsTo('deletionStatus')[0]!.body).toEqual({ receiptToken: readDeletionReceipt() });
  });
  it('does not automatically delete after reauthentication is required', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), requestDeletion: () => fail(403, 'REAUTH_REQUIRED') });
    renderApp(stub.fetch, '/settings/deletion');
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Delete my account' });
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await screen.findByText('Verify it’s you');
    await waitFor(() => expect(stub.callsTo('requestDeletion')).toHaveLength(1));
  });
  it('never requests deletion when receipt persistence fails', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), requestDeletion: () => ok(pending, 202) });
    renderApp(stub.fetch, '/settings/deletion');
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Delete my account' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await screen.findByText('Allow session storage before deleting your account so your removal receipt can be saved.');
    expect(stub.callsTo('requestDeletion')).toHaveLength(0);
  });
  it('retains the receipt when clearing private drafts', () => {
    const token = ensureDeletionReceipt(); clearAllPrivateState();
    expect(readDeletionReceipt()).toBe(token);
    expect(ensureDeletionReceipt()).toBe(token);
  });
  it('persists venue identity without provider display fields in a create draft', () => {
    saveDraft('create', { title: 'My dinner', venue: { venueRef: 'ref', placeId: 'place', available: true, name: 'Provider name', address: 'Provider address', location: { lat: 1, lng: 2 }, attributions: ['provider'], displayExpiresAt: 'tomorrow' } });
    expect(loadDraft('create')).toEqual({ title: 'My dinner', venue: { venueRef: 'ref', placeId: 'place', available: true, name: null, address: null, location: null, attributions: [], displayExpiresAt: null } });
  });

  it('NEEDS_SUPPORT shows the public support exit without sign-in; the mail link carries no receipt (AC-001a)', async () => {
    ensureDeletionReceipt(); rememberDeletionStatus({ ...pending, status: 'NEEDS_SUPPORT' });
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED') });
    renderApp(stub.fetch, '/settings/deletion');
    expect(await screen.findByRole('heading', { name: 'Contact support' })).toBeTruthy();
    expect(screen.getByTestId('support-email').textContent).toBe('xcheniepaut26@gmail.com');
    const link = screen.getByRole('link', { name: 'Email support' }) as HTMLAnchorElement;
    expect(link.href.startsWith('mailto:xcheniepaut26@gmail.com')).toBe(true);
    expect(link.href).not.toContain(readDeletionReceipt()!);
    expect(screen.getByText('Opening your email app doesn’t send anything by itself.')).toBeTruthy();
    expect(stub.calls.filter((c) => c.operationId !== 'getSession')).toHaveLength(0);
  });
  it('copy says Copied only after the clipboard accepted it, otherwise asks for manual selection (AC-001b)', async () => {
    ensureDeletionReceipt(); rememberDeletionStatus({ ...pending, status: 'NEEDS_SUPPORT' });
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED') });
    const write = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined);
    renderApp(stub.fetch, '/settings/deletion');
    // userEvent.setup() installs its own clipboard; replace it afterwards.
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    await user.click(await screen.findByRole('button', { name: 'Copy email address' }));
    expect(await screen.findByText('Couldn’t copy. Select the address above to copy it.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Copy email address' }));
    expect(await screen.findByText('Copied.')).toBeTruthy();
    expect(write).toHaveBeenLastCalledWith('xcheniepaut26@gmail.com');
  });
  it('an expired or unknown reference offers support instead of a dead end', async () => {
    ensureDeletionReceipt(); rememberDeletionStatus(pending);
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED'), deletionStatus: () => fail(410, 'RECEIPT_EXPIRED') });
    renderApp(stub.fetch, '/settings/deletion');
    const user = userEvent.setup();
    expect(screen.queryByRole('heading', { name: 'Contact support' })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Check removal status' }));
    expect(await screen.findByRole('heading', { name: 'Contact support' })).toBeTruthy();
  });
});
