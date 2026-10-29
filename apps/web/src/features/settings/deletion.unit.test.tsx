import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render.tsx';
import { createFetchStub, fail, ok } from '../../test/fetchStub.ts';
import { session } from '../../test/fixtures.ts';
import { clearAllPrivateState, saveDraft, loadDraft } from '../../lib/drafts.ts';
import { ensureDeletionReceipt, readDeletionReceipt, rememberDeletionStatus } from './deletionReceipt.ts';

const pending = { status: 'PENDING' as const, requestedAt: '2026-10-21T12:00:00Z', completedAt: null };
describe('account deletion (iOS DeleteAccountScreen)', () => {
  it('does not show a previous account receipt as the newly signed-in account deletion state',async()=>{
    const old=ensureDeletionReceipt();rememberDeletionStatus(pending);
    const stub=createFetchStub({getSession:()=>ok(session())});renderApp(stub.fetch,'/settings/deletion');
    await screen.findByRole('button',{name:'Delete my account'});
    expect(screen.queryByText(/Your account is being deleted/)).toBeNull();
    expect(ensureDeletionReceipt()).not.toBe(old);
  });
  it('persists a 256-bit receipt before the destructive request, clears private state, and checks with a body only', async () => {
    saveDraft('profile', { bio: 'private' });
    const stub = createFetchStub({ getSession: () => ok(session()), requestDeletion: c => {
      expect(readDeletionReceipt()).toBe((c.body as { receiptToken: string }).receiptToken);
      return ok(pending, 202);
    }, deletionStatus: () => ok({ ...pending, status: 'COMPLETED', completedAt: '2026-10-22T12:00:00Z' }) });
    renderApp(stub.fetch, '/delete-account');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByRole('heading', { name: 'Your account is being deleted' })).toBeTruthy();
    expect(screen.getByText(/Status: requested\./)).toBeTruthy();
    expect(screen.getByText(readDeletionReceipt()!)).toBeTruthy();
    expect(loadDraft('profile')).toBeNull();
    expect(readDeletionReceipt()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stub.callsTo('requestDeletion')[0]!.headers['if-match']).toBe('"3"');
    await user.click(screen.getByRole('link', { name: 'Check deletion status' }));
    expect((await screen.findByLabelText('Deletion reference') as HTMLInputElement).value).toBe(readDeletionReceipt());
    await user.click(screen.getByRole('button', { name: 'Check status' }));
    expect(await screen.findByText('Status: Completed')).toBeTruthy();
    expect(stub.callsTo('deletionStatus')[0]!.url.search).toBe('');
    expect(stub.callsTo('deletionStatus')[0]!.body).toEqual({ receiptToken: readDeletionReceipt() });
  });
  it('asks for an emailed code when re-authentication is required, then deletes with the same intent', async () => {
    let n = 0;
    const stub = createFetchStub({
      getSession: () => ok(session()),
      requestDeletion: () => (++n === 1 ? fail(403, 'REAUTH_REQUIRED') : ok(pending, 202)),
      startReauth: () => ok({ challengeId: '19191919-1919-4191-8191-191919191919', expiresAt: '2026-10-21T12:05:00.000Z' }, 201),
      verifyEmail: () => ok({ outcome: 'AUTHENTICATED' }),
    });
    renderApp(stub.fetch, '/delete-account');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('For your security, enter the code we just emailed you.')).toBeTruthy();
    expect(stub.callsTo('requestDeletion')).toHaveLength(1);
    expect(stub.callsTo('startReauth')[0]!.body).toMatchObject({ method: 'EMAIL' });
    await user.type(screen.getByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm and delete' }));
    expect(await screen.findByRole('heading', { name: 'Your account is being deleted' })).toBeTruthy();
    const [first, second] = stub.callsTo('requestDeletion');
    expect(second!.headers['idempotency-key']).toBe(first!.headers['idempotency-key']);
    expect(second!.body).toEqual(first!.body);
  });
  it('never requests deletion when receipt persistence fails', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), requestDeletion: () => ok(pending, 202) });
    renderApp(stub.fetch, '/delete-account');
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Delete my account' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await screen.findByText(/We couldn’t securely save your removal reference/);
    expect(stub.callsTo('requestDeletion')).toHaveLength(0);
  });
  it('checks a pasted reference while signed out and can forget the saved one', async () => {
    const token = ensureDeletionReceipt();
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED'), deletionStatus: () => fail(404, 'NOT_FOUND') });
    renderApp(stub.fetch, '/deletion-status');
    const user = userEvent.setup();
    const field = await screen.findByLabelText('Deletion reference') as HTMLInputElement;
    expect(field.value).toBe(token);
    await user.click(screen.getByRole('button', { name: 'Check status' }));
    expect((await screen.findByRole('alert')).textContent).toBe('We couldn’t find that reference.');
    await user.click(screen.getByRole('button', { name: 'Forget saved reference' }));
    expect(readDeletionReceipt()).toBeNull();
    expect(screen.getByText(/This does not cancel account deletion/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Check status' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter the 43-character reference you saved.');
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
