import {expect,it} from 'vitest';
import {screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {renderApp} from '../../test/render.tsx';
import {createFetchStub,fail,ok,meta} from '../../test/fetchStub.ts';
import {session,meal} from '../../test/fixtures.ts';
import {rememberReturnTo} from './completeSignIn.ts';
const target='/meals/33333333-3333-4333-8333-333333333333/apply';
it.each(['GOOGLE','APPLE'])('preserves the meal return target after %s cancellation and explicit retry',async()=>{
 let signed=false;const user=session();
 const stub=createFetchStub({getSession:()=>signed?ok(user):fail(401,'AUTH_REQUIRED'),getMe:()=>ok(user.user),oauthCallback:()=>fail(409,'STATE_CONFLICT'),startEmail:()=>({status:201,body:{data:{challengeId:'66666666-6666-4666-8666-666666666666',expiresAt:new Date(Date.now()+300000).toISOString(),resendAfter:new Date().toISOString()},meta:meta()}}),verifyEmail:()=>{signed=true;return ok({outcome:'AUTHENTICATED'});},getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:null})});
 rememberReturnTo(target);renderApp(stub.fetch,'/auth/callback?state=cancelled&error=access_denied');
 const retry=await screen.findByRole('link',{name:'Try again'});
 expect(retry.getAttribute('href')).toBe('/sign-in?returnTo='+encodeURIComponent(target));
 await userEvent.click(retry);await userEvent.click(await screen.findByRole('button',{name:'Continue with email'}));
 await userEvent.type(screen.getByLabelText('Email address'),'qa@example.test');await userEvent.click(screen.getByRole('button',{name:'Send code'}));
 await userEvent.type(await screen.findByLabelText('6-digit code'),'123456');await userEvent.click(screen.getByRole('button',{name:'Verify & continue'}));
 await waitFor(()=>expect(stub.callsTo('getMeal').length).toBeGreaterThan(0));
 expect((stub.callsTo('startEmail')[0]!.body as {returnTarget:string}).returnTarget).toBe(target);
 expect(stub.callsTo('applyMeal')).toHaveLength(0);
});
it('keeps an external stored return target out of the retry link',async()=>{
 rememberReturnTo('https://evil.example/apply');const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),oauthCallback:()=>fail(409,'STATE_CONFLICT')});
 renderApp(stub.fetch,'/auth/callback?state=cancelled&error=access_denied');
 expect((await screen.findByRole('link',{name:'Try again'})).getAttribute('href')).toBe('/sign-in?returnTo=%2Fdiscover');
});
