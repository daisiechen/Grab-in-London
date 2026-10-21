import { describe, expect, it, vi } from 'vitest';
import { act,render,screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, deferred,fail,ok,meta,type StubResponse } from '../../test/fetchStub.ts';
import { renderApp,testApi } from '../../test/render.tsx';
import { me, session } from '../../test/fixtures.ts';
import { browser } from '../../lib/browser.ts';
import {rememberLinkTicket,continueLink,expectLinkProof,linkForProof,pendingLink} from './completeSignIn.ts';
import {clearAll} from '../../lib/storage.ts';
import {ApiProvider} from '../../api/ApiProvider.tsx';
import {LinkConfirmation} from './LinkConfirmation.tsx';

const CHALLENGE = '66666666-6666-4666-8666-666666666666';
const resendIn30 = { challengeId: CHALLENGE, expiresAt: '2026-10-21T12:05:00.000Z', resendAfter: '2026-10-21T12:00:30.000Z' };

/** getSession is a guest until `signedIn()` flips. */
function authStub(user = session()) {
  let signedIn = false;
  const stub = createFetchStub({
    getSession: () => (signedIn ? ok(user) : fail(401, 'AUTH_REQUIRED')),
    getMe: () => ok(user.user),
    getPublicProfile: () => ok({ profile: { id: user.user.id, displayName: user.user.displayName, avatarUrl: null, bio: null, interests: [], languages: [] }, reviews: [], nextReviewCursor: null }),
    startEmail: () => ({ status: 201, body: { data: resendIn30, meta: meta() } }),
    verifyEmail: () => { signedIn = true; return ok({ outcome: 'AUTHENTICATED' }); },
  });
  return { stub, signIn: () => { signedIn = true; } };
}

async function enterEmailAndCode(code = '123456') {
  await userEvent.click(await screen.findByRole('button', { name: /Continue with email/ }));
  await userEvent.clear(screen.getByLabelText('Email address'));
  await userEvent.type(screen.getByLabelText('Email address'), 'sam@example.test');
  await userEvent.click(screen.getByRole('button', { name: /Send code/ }));
  await userEvent.type(await screen.findByLabelText('6-digit code'), code);
  await userEvent.click(screen.getByRole('button', { name: /Verify & continue/ }));
}

describe('email OTP sign-in (T05)', () => {
  it('explicitly verifies the original identity then connects with its proof, never automatically', async () => {
    const {stub,signIn}=authStub();let first=true;
    stub.on('verifyEmail',()=>{if(first){first=false;return ok({outcome:'LINK_REQUIRED',linkTicket:'l'.repeat(40),expiresAt:new Date(Date.now()+600000).toISOString()});}signIn();return ok({outcome:'AUTHENTICATED',authProof:CHALLENGE});});
    stub.on('linkIdentity',()=>ok({identities:[]}));renderApp(stub.fetch,'/sign-in?returnTo=%2Fprofile');
    await enterEmailAndCode();await userEvent.click(await screen.findByRole('button',{name:'Verify original sign-in'}));
    await enterEmailAndCode();expect(stub.callsTo('linkIdentity')).toHaveLength(0);
    await userEvent.click(await screen.findByRole('button',{name:'Connect this sign-in method'}));
    await waitFor(()=>expect(stub.callsTo('linkIdentity')).toHaveLength(1));
    expect(stub.callsTo('linkIdentity')[0]!.body).toEqual({linkTicket:'l'.repeat(40),originalChallengeProof:CHALLENGE});
  });
  it('verifies, refreshes the session and returns to the allow-listed page', async () => {
    const { stub } = authStub();
    renderApp(stub.fetch, '/sign-in?returnTo=%2Fprofile');
    await enterEmailAndCode();
    expect(await screen.findByRole('heading', { name: 'Sam Rivera' })).toBeTruthy();
    const start = stub.callsTo('startEmail')[0]!.body as Record<string, unknown>;
    expect(start).toMatchObject({ email: 'sam@example.test', client: 'WEB', returnTarget: '/profile' });
    expect(stub.callsTo('verifyEmail')[0]!.body).toMatchObject({ challengeId: CHALLENGE, code: '123456' });
    expect(stub.callsTo('getSession').length).toBeGreaterThanOrEqual(2);
  });

  it('never sends or follows a non-allow-listed return target', async () => {
    const { stub } = authStub();
    renderApp(stub.fetch, '/sign-in?returnTo=%2F%2Fevil.example%2Fx');
    await enterEmailAndCode();
    await waitFor(() => expect(stub.callsTo('verifyEmail')).toHaveLength(1));
    expect((stub.callsTo('startEmail')[0]!.body as { returnTarget: string }).returnTarget).toBe('/discover');
  });

  it('sends an incomplete profile through the gate with the original return path', async () => {
    const incomplete = session({ profileGate: { ageConfirmed: false, communityAccepted: false, profileComplete: false, missing: ['bio', 'age', 'community'] }, bio: null });
    const { stub } = authStub(incomplete);
    renderApp(stub.fetch, '/sign-in?returnTo=%2Fprofile');
    await enterEmailAndCode();
    expect(await screen.findByRole('heading', { name: 'A face. A little story. You.' })).toBeTruthy();
  });

  it('shows the resend countdown from the server clock and disables resend', async () => {
    const { stub } = authStub();
    renderApp(stub.fetch, '/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with email/ }));
    await userEvent.type(screen.getByLabelText('Email address'), 'sam@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Send code/ }));
    const resend = await screen.findByRole('button', { name: 'Resend code in 30s' });
    expect((resend as HTMLButtonElement).disabled).toBe(true);
  });

  it('rejects malformed emails before calling the API', async () => {
    const { stub } = authStub();
    renderApp(stub.fetch, '/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with email/ }));
    await userEvent.type(screen.getByLabelText('Email address'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /Send code/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter a valid email address.');
    expect(stub.callsTo('startEmail')).toHaveLength(0);
  });

  it('explains rate limits with the provider’s Retry-After', async () => {
    const { stub } = authStub();
    stub.on('startEmail', () => fail(429, 'RATE_LIMITED', { retryAfterSeconds: 45 }));
    renderApp(stub.fetch, '/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with email/ }));
    await userEvent.type(screen.getByLabelText('Email address'), 'sam@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Send code/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts. Try again in 45 seconds.');
  });

  it('distinguishes a wrong code from an expired/exhausted challenge', async () => {
    const { stub } = authStub();
    stub.on('verifyEmail', () => fail(422, 'VALIDATION_FAILED'));
    renderApp(stub.fetch, '/sign-in');
    await enterEmailAndCode('000000');
    expect((await screen.findByRole('alert')).textContent).toBe('That code isn’t right. Check your inbox and try again.');
    stub.on('verifyEmail', () => fail(409, 'STATE_CONFLICT'));
    await userEvent.click(screen.getByRole('button', { name: /Verify & continue/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/expired or has been tried too many times/));
  });

  it('LINK_REQUIRED issues no session and never merges automatically', async () => {
    const { stub } = authStub();
    stub.on('verifyEmail', () => ok({ outcome: 'LINK_REQUIRED', linkTicket: 'l'.repeat(40), expiresAt: new Date(Date.now()+600000).toISOString() }));
    renderApp(stub.fetch, '/sign-in');
    await enterEmailAndCode();
    expect(await screen.findByRole('heading', { name: 'You’ve been here before.' })).toBeTruthy();
    expect(stub.callsTo('getSession')).toHaveLength(1);
  });
});

describe('OAuth sign-in (T05)', () => {
  it.each([200,409,503])('ignores an old %s response after a new linking ticket has replaced it',async(status)=>{
    rememberLinkTicket('t'.repeat(43),new Date(Date.now()+600000).toISOString());continueLink();expectLinkProof(CHALLENGE);
    const held=deferred<StubResponse>(),{stub,signIn}=authStub();signIn();stub.on('oauthCallback',()=>ok({outcome:'AUTHENTICATED',authProof:CHALLENGE}));stub.on('linkIdentity',()=>held.promise);
    renderApp(stub.fetch,'/auth/callback?code=provider-code&state=provider-state');
    await userEvent.click(await screen.findByRole('button',{name:'Connect this sign-in method'}));
    rememberLinkTicket('n'.repeat(43),new Date(Date.now()+600000).toISOString());
    await act(async()=>{held.resolve(status===200?ok({identities:[]}):fail(status,status===409?'LINK_TICKET_INVALID':'PROVIDER_UNAVAILABLE'));});
    expect(pendingLink()?.ticket).toBe('n'.repeat(43));expect(screen.queryByRole('alert')).toBeNull();
  });
  it('isolates a replacement confirmation component from the previous in-flight attempt',async()=>{
    const held=deferred<StubResponse>(),stub=createFetchStub({linkIdentity:()=>held.promise}),api=testApi(stub.fetch);
    const done=vi.fn(),cancel=vi.fn(),reverify=vi.fn();
    rememberLinkTicket('t'.repeat(43),new Date(Date.now()+600000).toISOString());continueLink();expectLinkProof(CHALLENGE);const old=linkForProof(CHALLENGE)!;
    const view=render(<ApiProvider api={api}><LinkConfirmation key={`${old.ticket}:${CHALLENGE}`} pending={old} proof={CHALLENGE} onDone={done} onCancel={cancel} onReverify={reverify}/></ApiProvider>);
    await userEvent.click(screen.getByRole('button',{name:'Connect this sign-in method'}));
    const newProof='77777777-7777-4777-8777-777777777777';rememberLinkTicket('n'.repeat(43),new Date(Date.now()+600000).toISOString());continueLink();expectLinkProof(newProof);const next=linkForProof(newProof)!;
    view.rerender(<ApiProvider api={api}><LinkConfirmation key={`${next.ticket}:${newProof}`} pending={next} proof={newProof} onDone={done} onCancel={cancel} onReverify={reverify}/></ApiProvider>);
    await act(async()=>{held.resolve(fail(409,'LINK_TICKET_INVALID'));});
    expect(pendingLink()?.ticket).toBe(next.ticket);expect(done).not.toHaveBeenCalled();expect(screen.queryByRole('alert')).toBeNull();expect((screen.getByRole('button',{name:'Connect this sign-in method'}) as HTMLButtonElement).disabled).toBe(false);
  });
  it('ignores the old expiry callback after a new ticket replaces the confirmed flow',async()=>{
    const timers=vi.spyOn(globalThis,'setTimeout');
    rememberLinkTicket('t'.repeat(43),new Date(Date.now()+600000).toISOString());continueLink();expectLinkProof(CHALLENGE);
    const {stub,signIn}=authStub();signIn();stub.on('oauthCallback',()=>ok({outcome:'AUTHENTICATED',authProof:CHALLENGE}));
    renderApp(stub.fetch,'/auth/callback?code=provider-code&state=provider-state');
    await screen.findByRole('button',{name:'Connect this sign-in method'});
    const expire=timers.mock.calls.find(([,delay])=>typeof delay==='number'&&delay>290000)?.[0];expect(typeof expire).toBe('function');
    rememberLinkTicket('n'.repeat(43),new Date(Date.now()+600000).toISOString());
    act(()=>{if(typeof expire==='function')expire();});
    expect(pendingLink()?.ticket).toBe('n'.repeat(43));expect(screen.queryByRole('alert')).toBeNull();timers.mockRestore();
  });
  it('allows cancel after its own expiry while the link request remains in flight',async()=>{
    const timers=vi.spyOn(globalThis,'setTimeout'),held=deferred<StubResponse>();
    rememberLinkTicket('t'.repeat(43),new Date(Date.now()+600000).toISOString());continueLink();expectLinkProof(CHALLENGE);
    const {stub,signIn}=authStub();signIn();stub.on('oauthCallback',()=>ok({outcome:'AUTHENTICATED',authProof:CHALLENGE}));stub.on('linkIdentity',()=>held.promise);
    renderApp(stub.fetch,'/auth/callback?code=provider-code&state=provider-state');
    await userEvent.click(await screen.findByRole('button',{name:'Connect this sign-in method'}));
    const expire=timers.mock.calls.find(([,delay])=>typeof delay==='number'&&delay>290000)?.[0];
    act(()=>{if(typeof expire==='function')expire();});
    const cancel=screen.getByRole('button',{name:'Cancel linking'});expect((cancel as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(cancel);expect(await screen.findByRole('button',{name:/Continue with email/})).toBeTruthy();
    await act(async()=>{held.resolve(fail(409,'LINK_TICKET_INVALID'));});timers.mockRestore();
  });
  it('survives a full-page original OAuth return, keeps proof in RAM and retries only explicitly with the same key',async()=>{
    rememberLinkTicket('t'.repeat(43),new Date(Date.now()+600000).toISOString(),'/profile');continueLink();expectLinkProof(CHALLENGE);
    const {stub,signIn}=authStub();signIn();
    stub.on('oauthCallback',()=>ok({outcome:'AUTHENTICATED',authProof:CHALLENGE}));
    stub.on('linkIdentity',()=>{throw new TypeError('offline');});
    renderApp(stub.fetch,'/auth/callback?code=provider-code&state=provider-state');
    const button=await screen.findByRole('button',{name:'Connect this sign-in method'});
    expect(stub.callsTo('linkIdentity')).toHaveLength(0);expect(sessionStorage.getItem('fancy.auth.linkTicket')).not.toContain(CHALLENGE);
    await userEvent.click(button);await screen.findByRole('alert');expect(stub.callsTo('linkIdentity')).toHaveLength(1);
    stub.on('linkIdentity',()=>ok({identities:[]}));await userEvent.click(button);
    await waitFor(()=>expect(stub.callsTo('linkIdentity')).toHaveLength(2));
    const [first,second]=stub.callsTo('linkIdentity');expect(first!.body).toEqual(second!.body);expect(first!.headers['idempotency-key']).toBe(second!.headers['idempotency-key']);
    await waitFor(()=>expect(pendingLink()).toBeNull());
  });
  it.each(['ACCOUNT_LINK_CONFLICT','LINK_TICKET_INVALID'])('ends a confirmed OAuth link on %s without another attempt',async(code)=>{
    rememberLinkTicket('t'.repeat(43),new Date(Date.now()+600000).toISOString());continueLink();expectLinkProof(CHALLENGE);
    const {stub,signIn}=authStub();signIn();stub.on('oauthCallback',()=>ok({outcome:'AUTHENTICATED',authProof:CHALLENGE}));stub.on('linkIdentity',()=>fail(409,code));
    renderApp(stub.fetch,'/auth/callback?code=provider-code&state=provider-state');
    const button=await screen.findByRole('button',{name:'Connect this sign-in method'});await userEvent.click(button);
    await screen.findByRole('alert');expect((button as HTMLButtonElement).disabled).toBe(true);expect(pendingLink()).toBeNull();expect(stub.callsTo('linkIdentity')).toHaveLength(1);
    const cancel=screen.getByRole('button',{name:'Cancel linking'});expect((cancel as HTMLButtonElement).disabled).toBe(false);await userEvent.click(cancel);expect(await screen.findByRole('button',{name:/Continue with email/})).toBeTruthy();
  });
  it('cancels a confirmed link without consuming it on the server',async()=>{
    rememberLinkTicket('t'.repeat(43),new Date(Date.now()+600000).toISOString());continueLink();expectLinkProof(CHALLENGE);
    const {stub,signIn}=authStub();signIn();stub.on('oauthCallback',()=>ok({outcome:'AUTHENTICATED',authProof:CHALLENGE}));
    renderApp(stub.fetch,'/auth/callback?code=provider-code&state=provider-state');
    await userEvent.click(await screen.findByRole('button',{name:'Cancel linking'}));expect(pendingLink()).toBeNull();expect(stub.callsTo('linkIdentity')).toHaveLength(0);
  });
  it('refuses confirmation after private session state has been cleared',async()=>{
    rememberLinkTicket('t'.repeat(43),new Date(Date.now()+600000).toISOString());continueLink();expectLinkProof(CHALLENGE);
    const {stub,signIn}=authStub();signIn();stub.on('oauthCallback',()=>ok({outcome:'AUTHENTICATED',authProof:CHALLENGE}));
    renderApp(stub.fetch,'/auth/callback?code=provider-code&state=provider-state');
    const button=await screen.findByRole('button',{name:'Connect this sign-in method'});clearAll();await userEvent.click(button);
    expect((await screen.findByRole('alert')).textContent).toMatch(/session changed/);expect(stub.callsTo('linkIdentity')).toHaveLength(0);
  });
  it('redirects to the provider, then completes on /auth/callback back to the saved page', async () => {
    const assign = vi.spyOn(browser, 'assign').mockImplementation(() => {});
    const { stub, signIn } = authStub();
    stub.on('startOAuth', () => ({ status: 201, body: { data: { authorizationUrl: 'https://login.example.test/authorize?x=1', stateTransactionId: CHALLENGE }, meta: meta() } }));
    stub.on('oauthCallback', () => { signIn(); return ok({ outcome: 'AUTHENTICATED' }); });
    const first = renderApp(stub.fetch, '/sign-in?returnTo=%2Fprofile');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://login.example.test/authorize?x=1'));
    expect(stub.callsTo('startOAuth')[0]!.body).toMatchObject({ provider: 'GOOGLE', client: 'WEB', returnTarget: '/profile' });
    first.unmount();

    renderApp(stub.fetch, '/auth/callback?code=abc&state=st-1');
    expect(await screen.findByRole('heading', { name: 'Sam Rivera' })).toBeTruthy();
    const cb = stub.callsTo('oauthCallback');
    expect(cb).toHaveLength(1);
    expect(cb[0]!.url.searchParams.get('state')).toBe('st-1');
    expect(cb[0]!.url.searchParams.get('code')).toBe('abc');
  });

  it('refuses a non-https authorization URL', async () => {
    const assign = vi.spyOn(browser, 'assign').mockImplementation(() => {});
    const { stub } = authStub();
    stub.on('startOAuth', () => ({ status: 201, body: { data: { authorizationUrl: 'http://login.example.test/a', stateTransactionId: CHALLENGE }, meta: meta() } }));
    renderApp(stub.fetch, '/sign-in');
    await userEvent.click(await screen.findByRole('button', { name: /Continue with Apple/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });
});

void me;
