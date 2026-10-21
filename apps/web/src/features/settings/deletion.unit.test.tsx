import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render.tsx';
import { createFetchStub, fail, ok } from '../../test/fetchStub.ts';
import { session } from '../../test/fixtures.ts';
import { clearAllPrivateState, saveDraft, loadDraft } from '../../lib/drafts.ts';
import { ensureDeletionReceipt, readDeletionReceipt } from './deletionReceipt.ts';

const pending = { status: 'PENDING', requestedAt: '2026-10-21T12:00:00Z', completedAt: null };
describe('account deletion', () => {
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
});
