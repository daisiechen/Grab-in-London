import {deferred} from '../../test/deferred.ts';
import type {MockReply} from '../../test/mock-fetch.ts';
import { act,fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SurveyScreen } from './SurveyScreen.tsx';
import { ReportScreen } from './ReportScreen.tsx';
import { DeleteAccountScreen } from './DeleteAccountScreen.tsx';
import { DeletionStatusScreen } from './DeletionStatusScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { resetRouter, routeParams } from '../../test/router.ts';
import { fail, ok } from '../../test/mock-fetch.ts';
import { HOST_ID, credentials, me, sessionInfo } from '../../test/fixtures.ts';
import { base64UrlEncode } from '../../platform/base64url.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
jest.mock('expo-router', () => require('../../test/router.ts').expoRouterMock);

beforeEach(resetRouter);
const EXPECTED_RECEIPT = base64UrlEncode(Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256));

describe('SurveyScreen (S24)', () => {
  it('needs at least one answer, then saves with If-Match independent of any meal', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/product-survey', ok({ version: '1', again: null, reasons: [], submittedAt: null }));
    app.mock.on('PUT', '/v1/me/product-survey', ok({ version: '2', again: true, reasons: ['company'], submittedAt: '2026-10-21T10:00:00Z' }));
    await renderApp(app, <SurveyScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save survey' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Answer at least one question to save.');
    await fireEvent.press(screen.getByRole('radio', { name: 'Yes' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Company' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save survey' }));
    expect(await screen.findByText('Thank you. Your product survey is saved.')).toBeOnTheScreen();
    expect(app.mock.callsTo('PUT', '/v1/me/product-survey')[0]).toMatchObject({ body: { again: true, reasons: ['company'] }, headers: { 'if-match': '"1"' } });
  });
});

describe('ReportScreen', () => {
  it('sends a private report and shows the receipt, not a resolution', async () => {
    const app = createTestApp();
    await signIn(app, me());
    routeParams.current = { targetType: 'USER', targetId: HOST_ID };
    app.mock.on('POST', '/v1/reports', ok({ id: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d', receipt: 'FNC-7Q2K9', status: 'RECEIVED', targetType: 'USER', publicOutcome: null, createdAt: '2026-10-21T10:00:00Z' }, 201));
    await renderApp(app, <ReportScreen />);
    await fireEvent.changeText(screen.getByLabelText('What happened?'), 'Unwelcome messages after the meal.');
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText(/Reference FNC-7Q2K9/)).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', '/v1/reports')[0]?.body).toEqual({ targetType: 'USER', targetId: HOST_ID, reason: 'private_concern', details: 'Unwelcome messages after the meal.' });
  });

  it('rejects an invalid target', async () => {
    routeParams.current = { targetType: 'NOPE', targetId: HOST_ID };
    await renderApp(createTestApp(), <ReportScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent('This report link isn’t valid.');
  });
});

describe('DeleteAccountScreen (QA deletion receipt)', () => {
  it('REAUTH_REQUIRED → system-browser re-auth → retry with the same key and receipt → signed out, receipt shown', async () => {
    const app = createTestApp();
    app.mock.on('GET', '/v1/auth/session', ok({ ...sessionInfo(me()), amr: ['google'] }));
    await signIn(app, me());
    app.services.cache.set('meal:x', { private: true });
    app.services.drafts.set('create', { draft: true });
    app.mock.on('POST', '/v1/me/deletion', fail(403, 'REAUTH_REQUIRED'), 1);
    app.mock.on('POST', '/v1/auth/reauth', ok({ authorizationUrl: 'https://auth.example.test/reauth?state=reauth-state', expiresAt: '2026-10-21T10:05:00Z' }, 201));
    app.mock.on('GET', '/v1/auth/oauth/callback', ok({outcome:'AUTHENTICATED',session:sessionInfo(me()),authProof:'synthetic-proof'}));
    app.mock.on('POST', '/v1/auth/refresh', ok(credentials()));
    app.mock.on('POST', '/v1/me/deletion', ok({ status: 'PENDING', requestedAt: '2026-10-21T10:01:00Z', completedAt: null }, 202));
    app.openAuthSession.mockResolvedValueOnce({ type: 'success', url: 'fancy://auth/callback?code=synthetic-provider-code&state=reauth-state' });
    await renderApp(app, <DeleteAccountScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('Your account is being deleted')).toBeOnTheScreen();
    expect(screen.getByText(EXPECTED_RECEIPT)).toBeOnTheScreen();

    const deletions = app.mock.callsTo('POST', '/v1/me/deletion');
    expect(deletions).toHaveLength(2);
    expect(deletions[0]?.headers['idempotency-key']).toBe(deletions[1]?.headers['idempotency-key']);
    expect(deletions[0]?.body).toEqual({ confirm: true, receiptToken: EXPECTED_RECEIPT });
    expect(deletions[1]?.body).toEqual(deletions[0]?.body);
    expect(app.mock.callsTo('POST', '/v1/auth/reauth')[0]?.body).toMatchObject({ method: 'GOOGLE', appChallenge: 'C'.repeat(43) });
    expect(app.mock.callsTo('GET','/v1/auth/oauth/callback')[0]?.query.get('code')).toBe('synthetic-provider-code');
    expect(app.mock.callsTo('POST','/v1/auth/handoff')).toHaveLength(1); // original sign-in only
    await waitFor(() => expect(app.services.session.getState()).toEqual({ status: 'signedOut', reason: 'deleted' }));
    expect(app.store.value).toBeNull();
    expect(app.services.cache.size).toBe(0);
    expect(app.services.drafts.size).toBe(0);
  });
});

describe('DeletionStatusScreen', () => {
  it('checks status with the receipt in the body, never the URL', async () => {
    const app = createTestApp();
    app.mock.on('POST', '/v1/deletion-status', ok({ status: 'PROCESSING', requestedAt: '2026-10-21T10:01:00Z', completedAt: null }));
    await renderApp(app, <DeletionStatusScreen />);
    await fireEvent.changeText(screen.getByLabelText('Deletion reference'), EXPECTED_RECEIPT);
    await fireEvent.press(screen.getByRole('button', { name: 'Check status' }));
    expect(await screen.findByText('Status: In progress')).toBeOnTheScreen();
    const [call] = app.mock.callsTo('POST', '/v1/deletion-status');
    expect(call?.url).not.toContain(EXPECTED_RECEIPT);
    expect(call?.body).toEqual({ receiptToken: EXPECTED_RECEIPT });
  });
});

describe('DeleteAccountScreen email re-auth', () => {
  it('OTP sessions re-authenticate with an emailed code bound to the app challenge', async () => {
    const app = createTestApp();
    await signIn(app, me());
    const CHALLENGE = '1d6f0a3e-2b7c-4f8e-9a1d-3c5e7f9b2d40';
    app.mock.on('POST', '/v1/me/deletion', fail(403, 'REAUTH_REQUIRED'), 1);
    app.mock.on('POST', '/v1/auth/reauth', ok({ challengeId: CHALLENGE, expiresAt: '2026-10-21T10:05:00Z' }, 201));
    app.mock.on('POST', '/v1/auth/email/verify', ok({ outcome: 'AUTHENTICATED', session:sessionInfo(me()),authProof:'synthetic-proof' }));
    app.mock.on('POST', '/v1/auth/refresh', ok(credentials()));
    app.mock.on('GET', '/v1/auth/session', ok(sessionInfo(me())));
    app.mock.on('POST', '/v1/me/deletion', ok({ status: 'PENDING', requestedAt: '2026-10-21T10:01:00Z', completedAt: null }, 202));
    await renderApp(app, <DeleteAccountScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('For your security, enter the code we just emailed you.')).toBeOnTheScreen();
    expect(app.openAuthSession).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm and delete' }));
    expect(await screen.findByText('Your account is being deleted')).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', '/v1/auth/reauth')[0]?.body).toMatchObject({ method: 'EMAIL' });
    expect(app.mock.callsTo('POST', '/v1/auth/email/verify')[0]?.body).toMatchObject({ challengeId: CHALLENGE, code: '123456', appChallenge: 'C'.repeat(43) });
    const deletions = app.mock.callsTo('POST', '/v1/me/deletion');
    expect(deletions[0]?.headers['idempotency-key']).toBe(deletions[1]?.headers['idempotency-key']);
  });
});

async function pendingOAuthDeletion(){
 const app=createTestApp();await signIn(app,me());app.mock.on('GET','/v1/auth/session',ok({...sessionInfo(me()),amr:['google']}),1);await app.services.session.loadSession();
 app.mock.on('POST','/v1/me/deletion',fail(403,'REAUTH_REQUIRED'),1);app.mock.on('POST','/v1/auth/reauth',ok({authorizationUrl:'https://auth.example.test/reauth?state=reauth-state',expiresAt:'2026-10-21T10:05:00Z'},201));return app;
}
it.each(['switch','unmount'] as const)('does not continue deletion after a late browser callback when %s occurs',async action=>{
 const app=await pendingOAuthDeletion();const browser=deferred<Awaited<ReturnType<typeof app.services.openAuthSession>>>();app.openAuthSession.mockImplementationOnce(()=>browser.promise);
 const ui=await renderApp(app,<DeleteAccountScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Delete my account'}));await waitFor(()=>expect(app.openAuthSession).toHaveBeenCalledTimes(1));
 if(action==='switch')await act(async()=>{await app.services.session.expire();await signIn(app,me({id:'00000000-0000-4000-8000-000000000002'}));});else await ui.unmount();
 await act(async()=>{browser.resolve({type:'success',url:'fancy://auth/callback?code=old-provider-code&state=reauth-state'});});
 expect(app.mock.callsTo('GET','/v1/auth/oauth/callback')).toHaveLength(0);expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(1);
 if(action==='switch')expect(app.services.session.getState()).toMatchObject({status:'signedIn',session:{user:{id:'00000000-0000-4000-8000-000000000002'}}});
});
it('ignores late core reauth after account switch without deleting B or restoring A',async()=>{
 const app=await pendingOAuthDeletion();const callback=deferred<MockReply>();app.openAuthSession.mockResolvedValueOnce({type:'success',url:'fancy://auth/callback?code=old-code&state=reauth-state'});app.mock.on('GET','/v1/auth/oauth/callback',()=>callback.promise);
 await renderApp(app,<DeleteAccountScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Delete my account'}));await waitFor(()=>expect(app.mock.callsTo('GET','/v1/auth/oauth/callback')).toHaveLength(1));
 await act(async()=>{await app.services.session.expire();await signIn(app,me({id:'00000000-0000-4000-8000-000000000002'}));callback.resolve(ok({outcome:'AUTHENTICATED',session:sessionInfo(me()),authProof:'old-proof'}));});
 expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(1);expect(app.mock.callsTo('POST','/v1/auth/refresh')).toHaveLength(0);expect(app.services.session.getState()).toMatchObject({status:'signedIn',session:{user:{id:'00000000-0000-4000-8000-000000000002'}}});
});
it('does not delete on mismatched reauth identity or failed core provider verification',async()=>{
 for(const response of [ok({outcome:'AUTHENTICATED',session:sessionInfo(me({id:'00000000-0000-4000-8000-000000000002'})),authProof:'wrong-proof'}),fail(409,'STATE_CONFLICT')]){
  const app=await pendingOAuthDeletion();app.openAuthSession.mockResolvedValueOnce({type:'success',url:'fancy://auth/callback?code=code&state=reauth-state'});app.mock.on('GET','/v1/auth/oauth/callback',response);
  const ui=await renderApp(app,<DeleteAccountScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Delete my account'}));await screen.findByText('We couldn’t confirm it’s you. Please try again.');expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(1);expect(app.mock.callsTo('POST','/v1/auth/refresh')).toHaveLength(0);await ui.unmount();
 }
});
it('stops if the server still requires reauth after a verified same-family attempt',async()=>{
 const app=await pendingOAuthDeletion();app.openAuthSession.mockResolvedValueOnce({type:'success',url:'fancy://auth/callback?code=provider-code&state=reauth-state'});
 app.mock.on('GET','/v1/auth/oauth/callback',ok({outcome:'AUTHENTICATED',session:sessionInfo(me()),authProof:'proof'}));app.mock.on('POST','/v1/auth/refresh',ok(credentials()));app.mock.on('GET','/v1/auth/session',ok(sessionInfo(me())));app.mock.on('POST','/v1/me/deletion',fail(403,'REAUTH_REQUIRED'));
 await renderApp(app,<DeleteAccountScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Delete my account'}));await screen.findByText('We couldn’t delete your account. Please try again or contact support.');
 expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(2);expect(app.openAuthSession).toHaveBeenCalledTimes(1);
});
it('does not retry deletion after an invalid email reauth code',async()=>{
 const app=createTestApp();await signIn(app,me());app.mock.on('POST','/v1/me/deletion',fail(403,'REAUTH_REQUIRED'),1);app.mock.on('POST','/v1/auth/reauth',ok({challengeId:'1d6f0a3e-2b7c-4f8e-9a1d-3c5e7f9b2d40',expiresAt:'2026-10-21T10:05:00Z'},201));app.mock.on('POST','/v1/auth/email/verify',fail(422,'VALIDATION_FAILED'));
 await renderApp(app,<DeleteAccountScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Delete my account'}));await screen.findByLabelText('6-digit code');await fireEvent.changeText(screen.getByLabelText('6-digit code'),'111111');await fireEvent.press(screen.getByRole('button',{name:'Confirm and delete'}));await screen.findByText('That code doesn’t match. Check the six digits and try again.');
 expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(1);expect(app.mock.callsTo('POST','/v1/auth/refresh')).toHaveLength(0);
});
