/** Independent actual sign-in component: server-derived cooldown and explicit resend preserve email. */
import {it,expect,vi} from 'vitest';
import {act,screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {createFetchStub,ok,fail} from '../../test/fetchStub.ts';
import {renderApp} from '../../test/render.tsx';
it('QA-AUTH-003 expired code rejects and explicit post-cooldown resend preserves email with fresh challenge',async()=>{
 const base=Date.now(),id='66666666-6666-4666-8666-666666666666';let count=0;
 const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),startEmail:()=>ok({challengeId:++count===1?id:'77777777-7777-4777-8777-777777777777',expiresAt:'2026-10-21T12:05:00Z',resendAfter:'2026-10-21T12:00:30Z'},201),verifyEmail:()=>fail(409,'STATE_CONFLICT')});
 const interval=vi.spyOn(globalThis,'setInterval');renderApp(stub.fetch,'/sign-in');
 await userEvent.click(await screen.findByRole('button',{name:/Continue with email/}));await userEvent.type(screen.getByLabelText('Email address'),'qa-expiry@example.invalid');await userEvent.click(screen.getByRole('button',{name:/Send code/}));
 expect((await screen.findByRole('button',{name:'Resend code in 30s'})).hasAttribute('disabled')).toBe(true);expect(stub.callsTo('startEmail')).toHaveLength(1);
 await userEvent.type(screen.getByLabelText('6-digit code'),'000000');await userEvent.click(screen.getByRole('button',{name:/Verify & continue/}));expect((await screen.findByRole('alert')).textContent).toMatch(/expired|no longer|new code/i);
 const tick=interval.mock.calls.find(([,delay])=>delay===1000)?.[0];expect(typeof tick).toBe('function');vi.spyOn(Date,'now').mockReturnValue(base+31000);act(()=>{if(typeof tick==='function')tick();});
 await userEvent.click(await screen.findByRole('button',{name:/^Resend code$/}));expect(await screen.findByText('A new code is ready.')).toBeTruthy();expect(stub.callsTo('startEmail')).toHaveLength(2);for(const call of stub.callsTo('startEmail'))expect(call.body).toMatchObject({email:'qa-expiry@example.invalid'});expect(screen.getByLabelText('6-digit code')).toHaveProperty('value','');expect(screen.getByText(/Enter the six-digit code for qa-expiry/)).toBeTruthy();
});

import {rememberReturnTo} from './completeSignIn.ts';
import {MEAL_ID,meal,session} from '../../test/fixtures.ts';
it.each(['GOOGLE','APPLE'])('QA-AUTH-004 %s cancelled OAuth retains exact meal apply target without submitting application',async(provider)=>{
 const target=`/meals/${MEAL_ID}/apply`;rememberReturnTo(target);
 let signed=false;const stub=createFetchStub({getSession:()=>signed?ok(session()):fail(401,'AUTH_REQUIRED'),getMe:()=>ok(session().user),getMeal:()=>ok({meal:meal(),myApplication:null}),oauthCallback:()=>fail(409,'STATE_CONFLICT'),startEmail:()=>ok({challengeId:'66666666-6666-4666-8666-666666666666',expiresAt:'2026-10-21T12:05:00Z',resendAfter:'2026-10-21T12:00:30Z'},201),verifyEmail:()=>{signed=true;return ok({outcome:'AUTHENTICATED'});}});
 renderApp(stub.fetch,`/auth/callback?state=qa-${provider}&error=access_denied`);
 expect(await screen.findByRole('heading',{name:'Sign-in didn’t finish.'})).toBeTruthy();expect(stub.callsTo('applyMeal')).toHaveLength(0);
 expect(screen.getByRole('link',{name:'Try again'}).getAttribute('href')).toBe(`/sign-in?returnTo=${encodeURIComponent(target)}`);
 await userEvent.click(screen.getByRole('link',{name:'Try again'}));await userEvent.click(await screen.findByRole('button',{name:/Continue with email/}));await userEvent.type(screen.getByLabelText('Email address'),'qa-retry@example.invalid');await userEvent.click(screen.getByRole('button',{name:/Send code/}));await userEvent.type(await screen.findByLabelText('6-digit code'),'000000');await userEvent.click(screen.getByRole('button',{name:/Verify & continue/}));expect(await screen.findByRole('heading',{name:'Pull up a chair.'})).toBeTruthy();expect(screen.getByText('Friday dinner & new faces')).toBeTruthy();expect(stub.callsTo('applyMeal')).toHaveLength(0);expect(stub.callsTo('startEmail')[0]!.body).toMatchObject({returnTarget:target});
});
