import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SignInScreen } from './SignInScreen.tsx';
import { LinkRequiredScreen } from './LinkRequiredScreen.tsx';
import { createTestApp, renderApp, signIn } from '../../../test/render.tsx';
import { mockRouter, resetRouter } from '../../../test/router.ts';
import { ok } from '../../../test/mock-fetch.ts';
import { NOW, HANDOFF, credentials, sessionInfo } from '../../../test/fixtures.ts';
import { acceptLinkProof,clearPendingLink,getPendingLink,setPendingLink } from '../link.ts';
import { verifyEmailCode } from '../otp.ts';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory
jest.mock('expo-router',()=>require('../../../test/router.ts').expoRouterMock);
const proof='12345678-1234-4234-8234-123456789012';
const ticket={linkTicket:'t'.repeat(40),appVerifier:'v'.repeat(43),expiresAt:new Date(NOW+600_000).toISOString()};
beforeEach(()=>{clearPendingLink();resetRouter();});
it('original Google login retains core proof and routes to explicit link confirmation before profile/business',async()=>{
 const app=createTestApp();setPendingLink(ticket,NOW,'intent');
 app.mock.on('POST','/v1/auth/oauth/start',ok({authorizationUrl:'https://auth.example.test/a?state=s',stateTransactionId:proof},201));
 app.openAuthSession.mockResolvedValue({type:'success',url:'fancy://auth/callback?code=p&state=s'});
 app.mock.on('GET','/v1/auth/oauth/callback',ok({outcome:'AUTHENTICATED',handoffCode:HANDOFF,authProof:proof}));
 app.mock.on('POST','/v1/auth/handoff',ok(credentials()));app.mock.on('GET','/v1/auth/session',ok(sessionInfo()));
 await renderApp(app,<SignInScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Continue with Google'}));
 await waitFor(()=>expect(mockRouter.replace).toHaveBeenCalledWith('/link-required'));
 expect(getPendingLink(NOW)?.proof?.value).toBe(proof);
 expect(app.mock.callsTo('POST','/v1/auth/links')).toHaveLength(0);
});
it('OTP preserves new-identity verifier and original-identity proof from core JSON',async()=>{
 const app=createTestApp();const challenge={challengeId:proof,email:'a@example.test',expiresAt:NOW+600_000,resendAfter:NOW};
 app.mock.on('POST','/v1/auth/email/verify',ok({outcome:'LINK_REQUIRED',linkTicket:ticket.linkTicket,expiresAt:ticket.expiresAt}),1);
 expect(await verifyEmailCode(app.services,challenge,'000000',NOW)).toMatchObject({kind:'linkRequired',appVerifier:'V'.repeat(43)});
 expect(app.store.value).toBeNull();
 app.mock.on('POST','/v1/auth/email/verify',ok({outcome:'AUTHENTICATED',handoffCode:HANDOFF,authProof:proof}),1);
 app.mock.on('POST','/v1/auth/handoff',ok(credentials()));app.mock.on('GET','/v1/auth/session',ok(sessionInfo()));
 expect(await verifyEmailCode(app.services,challenge,'000000',NOW)).toMatchObject({kind:'signedIn',authProof:proof});
});
it('confirmation makes no request until pressed, then revalidates; cancellation erases RAM secrets',async()=>{
 const app=createTestApp();await signIn(app);setPendingLink(ticket,NOW,'intent');acceptLinkProof(sessionInfo(),proof,app.services.session.generation,NOW);
 app.mock.on('POST','/v1/auth/refresh',ok(credentials()));app.mock.on('POST','/v1/auth/links',ok({identities:[]}));app.mock.on('GET','/v1/auth/session',ok(sessionInfo()));
 const view=await renderApp(app,<LinkRequiredScreen/>);expect(app.mock.callsTo('POST','/v1/auth/links')).toHaveLength(0);
 await fireEvent.press(screen.getByRole('button',{name:'Confirm account link'}));await waitFor(()=>expect(mockRouter.replace).toHaveBeenCalledWith('/'));
 expect(getPendingLink(NOW)).toBeNull();await view.unmount();
 setPendingLink(ticket,NOW,'intent');await renderApp(app,<LinkRequiredScreen/>);
 await fireEvent.press(screen.getByRole('button',{name:'Cancel account link'}));expect(getPendingLink(NOW)).toBeNull();
});

it('provider cancellation clears the pending link; ticket and proof never enter credential storage',async()=>{
 const app=createTestApp();setPendingLink(ticket,NOW,'intent');
 app.mock.on('POST','/v1/auth/oauth/start',ok({authorizationUrl:'https://auth.example.test/a?state=s',stateTransactionId:proof},201));
 await renderApp(app,<SignInScreen/>);await fireEvent.press(screen.getByRole('button',{name:'Continue with Apple'}));
 await waitFor(()=>expect(getPendingLink(NOW)).toBeNull());
 expect(app.store.writes).toHaveLength(0);
 expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('unmounted confirmation cannot navigate a later link flow',async()=>{
 const app=createTestApp();await signIn(app);setPendingLink(ticket,NOW,'old');acceptLinkProof(sessionInfo(),proof,app.services.session.generation,NOW);
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 app.mock.on('POST','/v1/auth/links',async()=>{await gate;return ok({identities:[]});});
 const view=await renderApp(app,<LinkRequiredScreen/>);
 await fireEvent.press(screen.getByRole('button',{name:'Confirm account link'}));
 await waitFor(()=>expect(app.mock.callsTo('POST','/v1/auth/links')).toHaveLength(1));
 await view.unmount();clearPendingLink();setPendingLink({...ticket,linkTicket:'n'.repeat(40)},NOW,'new');release();
 await waitFor(()=>expect(getPendingLink(NOW)?.linkTicket).toBe('n'.repeat(40)));
 expect(mockRouter.replace).not.toHaveBeenCalled();
});
