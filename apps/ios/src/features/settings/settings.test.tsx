import * as SecureStore from 'expo-secure-store';
import {memoryDeletionReceiptStore,secureDeletionReceiptStore} from './deletion-receipt-store.ts';
import {deferred} from '../../test/deferred.ts';
import type {MockReply} from '../../test/mock-fetch.ts';
import { act,fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SurveyScreen } from './SurveyScreen.tsx';
import { ReportScreen } from './ReportScreen.tsx';
import { DeleteAccountScreen } from './DeleteAccountScreen.tsx';
import { DeletionStatusScreen } from './DeletionStatusScreen.tsx';
import { SettingsScreen } from './SettingsScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../test/render.tsx';
import { mockRouter, resetRouter, routeParams } from '../../test/router.ts';
import { fail, ok } from '../../test/mock-fetch.ts';
import { HOST_ID, MEAL_ID, credentials, meal, me, publicProfile, sessionInfo } from '../../test/fixtures.ts';
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
    expect(screen.getByText(/separate from your private meal rating/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save survey' }));
    expect(await screen.findByText('Thank you. Your product survey is saved.')).toBeOnTheScreen();
    expect(app.mock.callsTo('PUT', '/v1/me/product-survey')[0]).toMatchObject({ body: { again: true, reasons: ['company'] }, headers: { 'if-match': '"1"' } });
  });

  it('places the save button inline right after the questions, not in a pinned bar', async () => {
    const app = createTestApp();
    await signIn(app, me());
    app.mock.on('GET', '/v1/me/product-survey', ok({ version: '1', again: null, reasons: [], submittedAt: null }));
    await renderApp(app, <SurveyScreen />);
    const actions = await screen.findByTestId('survey-actions');
    expect(within(actions).getByRole('button', { name: 'Save survey' })).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Save survey' })).toHaveLength(1);
  });
});

describe('SettingsScreen groups', () => {
  it('shows the demo groups for a signed-in member and routes each row', async () => {
    const app = createTestApp();
    await signIn(app, me());
    await renderApp(app, <SettingsScreen />);
    for (const title of ['Notifications & previews', 'Privacy & safety', 'Help shape Fancy', 'Account']) expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    expect(screen.getByLabelText('App language: English')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Allow analytics' })).toBeOnTheScreen();
    for (const [label, route] of [['Notifications', '/notifications'], ['Product survey', '/survey'], ['Edit public profile', '/profile-edit'], ['Check deletion status', '/deletion-status'], ['Delete account', '/delete-account']] as const) {
      await fireEvent.press(screen.getByRole('button', { name: label }));
      expect(mockRouter.push).toHaveBeenLastCalledWith(route);
    }
  });

  it('renders information rows as plain, non-interactive text and keeps chevron rows as buttons', async () => {
    const app = createTestApp();
    await signIn(app, me());
    await renderApp(app, <SettingsScreen />);
    const info = screen.getAllByTestId('settings-info');
    expect(info.map((row) => row.props.accessibilityLabel)).toEqual(['Blocked members: Manage on their profile', 'App language: English']);
    for (const row of info) expect(row.props.accessibilityRole).toBe('text');
    for (const label of ['Blocked members', 'App language', 'Manage on their profile', 'English']) expect(screen.queryByRole('button', { name: label })).toBeNull();
    const value = StyleSheet.flatten(within(info[1]!).getByText('English').props.style);
    expect(value.fontWeight).toBeUndefined();
  });

  it('guests only see public privacy copy and deletion status', async () => {
    await renderApp(createTestApp(), <SettingsScreen />);
    expect(screen.getByRole('button', { name: 'Check deletion status' })).toBeOnTheScreen();
    for (const label of ['Sign out', 'Delete account', 'Product survey', 'Notifications', 'Edit public profile']) expect(screen.queryByRole('button', { name: label })).toBeNull();
  });
});

describe('ReportScreen', () => {
  it('sends a private report and shows the receipt, not a resolution', async () => {
    const app = createTestApp();
    await signIn(app, me());
    routeParams.current = { targetType: 'USER', targetId: HOST_ID };
    app.mock.on('POST', '/v1/reports', ok({ id: '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d', receipt: 'FNC-7Q2K9', status: 'RECEIVED', targetType: 'USER', publicOutcome: null, createdAt: '2026-10-21T10:00:00Z' }, 201));
    await renderApp(app, <ReportScreen />);
    await fireEvent.changeText(screen.getByLabelText('What would you like us to know?'), 'Unwelcome messages after the meal.');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit report' }));
    expect(await screen.findByText('FNC-7Q2K9')).toBeOnTheScreen();
    expect(screen.getByText('Status: Received')).toBeOnTheScreen();
    expect(screen.queryByText(/resolved|action taken/i)).toBeNull();
    expect(app.mock.callsTo('POST', '/v1/reports')[0]?.body).toEqual({ targetType: 'USER', targetId: HOST_ID, reason: 'private_concern', details: 'Unwelcome messages after the meal.' });
  });

  it('looks up the status of the report by its id and shows any public outcome', async () => {
    const app = createTestApp();
    await signIn(app, me());
    routeParams.current = { targetType: 'MEAL', targetId: HOST_ID };
    const ID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';
    const receipt = { id: ID, receipt: 'FNC-7Q2K9', status: 'RECEIVED', targetType: 'MEAL', publicOutcome: null, createdAt: '2026-10-21T10:00:00Z' };
    app.mock.on('POST', '/v1/reports', ok(receipt, 201));
    app.mock.on('GET', `/v1/me/reports/${ID}`, fail(503, 'PROVIDER_UNAVAILABLE'), 1);
    app.mock.on('GET', `/v1/me/reports/${ID}`, ok({ ...receipt, status: 'RESPONDED', publicOutcome: 'We spoke with the host.' }));
    await renderApp(app, <ReportScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Submit report' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Tell us what happened in up to 1,000 characters.');
    expect(app.mock.callsTo('POST', '/v1/reports')).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText('What would you like us to know?'), 'The venue was not as described.');
    await fireEvent.press(screen.getByRole('button', { name: 'Submit report' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Check report status' }));
    expect(await screen.findByText('We couldn’t check the status. Please try again.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Check report status' }));
    expect(await screen.findByText('Status: Responded')).toBeOnTheScreen();
    expect(screen.getByText('We spoke with the host.')).toBeOnTheScreen();
    expect(app.mock.callsTo('POST', '/v1/reports')).toHaveLength(1);
  });

  it('rejects an invalid target, with a way out', async () => {
    routeParams.current = { targetType: 'NOPE', targetId: HOST_ID };
    await renderApp(createTestApp(), <ReportScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent('This report link isn’t valid.');
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('names the reported member with their avatar, and Cancel dismisses without sending', async () => {
    const app = createTestApp();
    await signIn(app, me());
    routeParams.current = { targetType: 'USER', targetId: HOST_ID };
    app.mock.on('GET', `/v1/profiles/${HOST_ID}`, ok({ profile: publicProfile(HOST_ID, 'Maya'), reviews: [], nextReviewCursor: null }));
    await renderApp(app, <ReportScreen />);
    expect(await screen.findByLabelText('Reporting Maya')).toBeOnTheScreen();
    expect(within(screen.getByTestId('report-target')).getByText('Maya')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(app.mock.callsTo('POST', '/v1/reports')).toHaveLength(0);
  });

  it('names the reported meal with its date; the text box is roomy and Submit is pinned above the keyboard', async () => {
    const app = createTestApp();
    await signIn(app, me());
    routeParams.current = { targetType: 'MEAL', targetId: MEAL_ID };
    app.mock.on('GET', `/v1/meals/${MEAL_ID}`, ok({ meal: meal(), myApplication: null, conversationId: null }));
    await renderApp(app, <ReportScreen />);
    expect(await screen.findByLabelText('Reporting Sunday dinner')).toBeOnTheScreen();
    const input = screen.getByLabelText('What would you like us to know?');
    expect(StyleSheet.flatten(input.props.style).minHeight).toBeGreaterThanOrEqual(140);
    // Pinned footer: an inline button ended up behind the keyboard on device.
    expect(screen.getByTestId('account-footer')).toContainElement(screen.getByRole('button', { name: 'Submit report' }));
    expect(screen.getByTestId('account-footer')).toContainElement(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('keeps a generic target line when the lookup fails', async () => {
    const app = createTestApp();
    await signIn(app, me());
    routeParams.current = { targetType: 'USER', targetId: HOST_ID };
    app.mock.on('GET', `/v1/profiles/${HOST_ID}`, fail(503, 'PROVIDER_UNAVAILABLE'));
    await renderApp(app, <ReportScreen />);
    await waitFor(() => expect(app.mock.callsTo('GET', `/v1/profiles/${HOST_ID}`)).toHaveLength(1));
    expect(screen.getByLabelText('Reporting A member')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Submit report' })).toBeEnabled();
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

describe('DeleteAccountScreen layout', () => {
  it('uses a red destructive button for deletion, inline after the explanation', async () => {
    const app = createTestApp();
    await signIn(app, me());
    await renderApp(app, <DeleteAccountScreen />);
    const actions = screen.getByTestId('delete-actions');
    const button = within(actions).getByRole('button', { name: 'Delete my account' });
    expect(StyleSheet.flatten(screen.getByTestId('destructive-button').props.style).backgroundColor).toBe('#a93b32');
    expect(button).toBeOnTheScreen();
    await fireEvent.press(within(actions).getByRole('button', { name: 'Keep my account' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
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

describe('Native deletion reference survives lost acceptance',()=>{
 it('saves before request; lost202 then real401 and service remount can explicitly query without destructive resend',async()=>{

  const receipts=memoryDeletionReceiptStore();const app=createTestApp({deletionReceiptStore:receipts});await signIn(app);
  let accepted=false;
  app.mock.on('POST','/v1/me/deletion',async call=>{expect((await receipts.read())?.receiptToken===(call.body as {receiptToken:string}).receiptToken).toBe(true);accepted=true;throw new TypeError('Network request failed');});
  const ui=await renderApp(app,<DeleteAccountScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Delete my account'}));
  await screen.findByText('We couldn’t confirm the request. Check your connection and try again.');expect(accepted).toBe(true);
  app.mock.on('GET','/v1/auth/session',fail(401,'AUTH_REQUIRED'));app.mock.on('POST','/v1/auth/refresh',fail(401,'AUTH_REQUIRED'));
  await act(async()=>{await app.services.session.revalidate();});expect(app.services.session.getState().status).toBe('signedOut');await ui.unmount();
  const cold=createTestApp({deletionReceiptStore:receipts});await cold.services.session.restore();
  cold.mock.on('POST','/v1/deletion-status',ok({status:'PENDING',requestedAt:'2026-10-21T10:01:00Z',completedAt:null}));
  await renderApp(cold,<DeletionStatusScreen/>);await waitFor(()=>expect(screen.getByLabelText('Deletion reference').props.value.length===43).toBe(true));
  expect(cold.mock.callsTo('POST','/v1/deletion-status')).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button',{name:'Check status'}));await screen.findByText('Status: Requested');
  expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(1);expect(cold.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button',{name:'Forget saved reference'}));await waitFor(()=>expect(screen.getByLabelText('Deletion reference').props.value).toBe(''));expect(await receipts.read()).toBeNull();
  expect(screen.getByText('Saved reference removed from this device. This does not cancel account deletion.')).toBeOnTheScreen();
 });
 it.each(['read','write'])('does not delete if secure persistence %s fails',async operation=>{
  const store={read:async()=>{if(operation==='read')throw new Error('locked');return null;},write:async()=>{throw new Error('locked');},clear:async()=>{}};const app=createTestApp({deletionReceiptStore:store});await signIn(app);
  await renderApp(app,<DeleteAccountScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Delete my account'}));await screen.findByText('We couldn’t securely save your removal reference. Try again before deleting your account.');expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(0);
 });
 it('does not expose another signed-in actor saved reference or automatically query it',async()=>{
  const receipts=memoryDeletionReceiptStore();await receipts.write({ownerId:HOST_ID,key:HOST_ID,receiptToken:EXPECTED_RECEIPT});
  const app=createTestApp({deletionReceiptStore:receipts});await signIn(app,me());await renderApp(app,<DeletionStatusScreen/>);
  await act(async()=>{});expect(screen.getByLabelText('Deletion reference').props.value).toBe('');expect(screen.queryByRole('button',{name:'Forget saved reference'})).toBeNull();expect(app.mock.callsTo('POST','/v1/deletion-status')).toHaveLength(0);
 });
});


describe('Removal reference actor and installation boundaries',()=>{
 it('rejects stale secure-save completion before any destructive request after actor switch',async()=>{
  const pending=deferred<void>();
  const store={read:async()=>null,write:jest.fn(()=>pending.promise),clear:async()=>{}};
  const app=createTestApp({deletionReceiptStore:store});await signIn(app);await renderApp(app,<DeleteAccountScreen/>);
  await fireEvent.press(screen.getByRole('button',{name:'Delete my account'}));
  await waitFor(()=>expect(store.write).toHaveBeenCalledTimes(1));
  await act(async()=>{await signIn(app,me({id:HOST_ID}));pending.resolve();});
  expect(store.write).toHaveBeenCalledTimes(1);expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(0);
 });
 it('does not show a late restored reference after switching to another actor',async()=>{
  const pending=deferred<import('./deletion-receipt-store.ts').DeletionReceipt|null>();
  const store={read:()=>pending.promise,write:async()=>{},clear:async()=>{}};
  const app=createTestApp({deletionReceiptStore:store});await signIn(app);await renderApp(app,<DeletionStatusScreen/>);
  const owner=app.services.session.getState();if(owner.status!=='signedIn')throw new Error('test sign-in failed');
  await act(async()=>{await signIn(app,me({id:HOST_ID}));pending.resolve({ownerId:owner.session.user.id,key:HOST_ID,receiptToken:EXPECTED_RECEIPT});});
  expect(screen.getByLabelText('Deletion reference').props.value).toBe('');expect(app.mock.callsTo('POST','/v1/deletion-status')).toHaveLength(0);
 });
 it('install marker clears old Keychain receipt on reinstall; ordinary session end preserves it',async()=>{
  const receipts=memoryDeletionReceiptStore();await receipts.write({ownerId:HOST_ID,key:HOST_ID,receiptToken:EXPECTED_RECEIPT});
  const marker={isPresent:jest.fn(async()=>false),set:jest.fn(async()=>{})};const app=createTestApp({deletionReceiptStore:receipts,installMarker:marker});
  await app.services.session.restore();expect(await receipts.read()).toBeNull();expect(marker.set).toHaveBeenCalledTimes(1);
  await receipts.write({ownerId:HOST_ID,key:HOST_ID,receiptToken:EXPECTED_RECEIPT});await app.services.session.expire();expect((await receipts.read())!==null).toBe(true);
 });
});

it('receipt-only status does not refresh a stale revoked session and ignores late actor status response',async()=>{
 let now=Date.parse('2026-10-21T10:00:00Z');const app=createTestApp({now:()=>now});await signIn(app);
 const pending=deferred<MockReply>();app.mock.on('POST','/v1/deletion-status',()=>pending.promise,1);
 const ui=await renderApp(app,<DeletionStatusScreen/>);await fireEvent.changeText(screen.getByLabelText('Deletion reference'),EXPECTED_RECEIPT);
 now+=20*60_000;
 await fireEvent.press(screen.getByRole('button',{name:'Check status'}));await waitFor(()=>expect(app.mock.callsTo('POST','/v1/deletion-status')).toHaveLength(1));
 expect(app.mock.callsTo('POST','/v1/auth/refresh')).toHaveLength(0);expect(app.mock.callsTo('POST','/v1/deletion-status')[0]?.headers.authorization).toBeUndefined();
 now=Date.parse('2026-10-21T10:00:00Z');await act(async()=>{await signIn(app,me({id:HOST_ID}));pending.resolve(ok({status:'COMPLETED',requestedAt:'2026-10-21T10:01:00Z',completedAt:'2026-10-21T10:02:00Z'}));});
 expect(screen.queryByText('Status: Completed')).toBeNull();
 app.mock.on('POST','/v1/deletion-status',ok({status:'PENDING',requestedAt:'2026-10-21T10:01:00Z',completedAt:null}));
 await fireEvent.changeText(screen.getByLabelText('Deletion reference'),EXPECTED_RECEIPT);await fireEvent.press(screen.getByRole('button',{name:'Check status'}));await screen.findByText('Status: Requested');await ui.unmount();
});


it('does not display the successful old actor receipt when another user signs in',async()=>{
 const app=createTestApp();await signIn(app);app.mock.on('POST','/v1/me/deletion',ok({status:'PENDING',requestedAt:'2026-10-21T10:01:00Z',completedAt:null},202));
 await renderApp(app,<DeleteAccountScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Delete my account'}));await screen.findByText('Your account is being deleted');
 await act(async()=>{await signIn(app,me({id:HOST_ID}));});expect(screen.queryByText(EXPECTED_RECEIPT)).toBeNull();expect(screen.queryByText('Your account is being deleted')).toBeNull();
});


it('late saved-reference load does not overwrite typed input, and editing invalidates an older status query',async()=>{
 const load=deferred<import('./deletion-receipt-store.ts').DeletionReceipt|null>();
 const app=createTestApp({deletionReceiptStore:{read:()=>load.promise,write:async()=>{},clear:async()=>{}}});await app.services.session.restore();
 const pending=deferred<MockReply>();app.mock.on('POST','/v1/deletion-status',()=>pending.promise);
 await renderApp(app,<DeletionStatusScreen/>);const typed='t'.repeat(43);await fireEvent.changeText(screen.getByLabelText('Deletion reference'),typed);
 await act(async()=>{load.resolve({ownerId:HOST_ID,key:HOST_ID,receiptToken:EXPECTED_RECEIPT});});expect(screen.getByLabelText('Deletion reference').props.value===typed).toBe(true);
 await fireEvent.press(screen.getByRole('button',{name:'Check status'}));await fireEvent.changeText(screen.getByLabelText('Deletion reference'),'u'.repeat(43));
 await act(async()=>{pending.resolve(ok({status:'COMPLETED',requestedAt:'2026-10-21T10:01:00Z',completedAt:'2026-10-21T10:02:00Z'}));});expect(screen.queryByText('Status: Completed')).toBeNull();
});


it('real secure receipt adapter survives SessionManager401 and fresh Services, while reinstall marker clears old Keychain reference',async()=>{
 const keychain=new Map<string,string>();
 const get=jest.spyOn(SecureStore,'getItemAsync').mockImplementation(async key=>keychain.get(key)??null);
 const set=jest.spyOn(SecureStore,'setItemAsync').mockImplementation(async(key,value)=>{keychain.set(key,value);});
 const remove=jest.spyOn(SecureStore,'deleteItemAsync').mockImplementation(async key=>{keychain.delete(key);});
 try {
  const marker={isPresent:async()=>true,set:async()=>{}};
  const app=createTestApp({deletionReceiptStore:secureDeletionReceiptStore(),installMarker:marker});await signIn(app);
  app.mock.on('POST','/v1/me/deletion',async call=>{const persisted=await app.services.deletionReceipts.read();expect(persisted?.receiptToken===(call.body as {receiptToken:string}).receiptToken).toBe(true);throw new TypeError('Network request failed');});
  const first=await renderApp(app,<DeleteAccountScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Delete my account'}));await screen.findByText('We couldn’t confirm the request. Check your connection and try again.');
  app.mock.on('GET','/v1/auth/session',fail(401,'AUTH_REQUIRED'));app.mock.on('POST','/v1/auth/refresh',fail(401,'AUTH_REQUIRED'));
  await act(async()=>{await app.services.session.revalidate();});expect(app.services.session.getState().status).toBe('signedOut');await first.unmount();
  const cold=createTestApp({deletionReceiptStore:secureDeletionReceiptStore(),installMarker:marker});await cold.services.session.restore();
  cold.mock.on('POST','/v1/deletion-status',ok({status:'PENDING',requestedAt:'2026-10-21T10:01:00Z',completedAt:null}));
  const second=await renderApp(cold,<DeletionStatusScreen/>);await waitFor(()=>expect(screen.getByLabelText('Deletion reference').props.value.length===43).toBe(true));
  expect(cold.mock.callsTo('POST','/v1/deletion-status')).toHaveLength(0);await fireEvent.press(screen.getByRole('button',{name:'Check status'}));await screen.findByText('Status: Requested');
  expect(cold.mock.callsTo('POST','/v1/deletion-status')[0]?.headers.authorization).toBeUndefined();expect(cold.mock.callsTo('POST','/v1/auth/refresh')).toHaveLength(0);expect(cold.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(0);await second.unmount();
  const reinstall=createTestApp({deletionReceiptStore:secureDeletionReceiptStore(),installMarker:{isPresent:async()=>false,set:async()=>{}}});await reinstall.services.session.restore();expect(await reinstall.services.deletionReceipts.read()).toBeNull();
 } finally {get.mockRestore();set.mockRestore();remove.mockRestore();}
});
