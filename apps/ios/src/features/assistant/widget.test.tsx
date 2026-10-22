import {memoryAIConversationStore} from './session-store.ts';
import {memoryGuestCredentialStore} from './guest-store.ts';
import {flush} from '../../test/deferred.ts';
import {ok,fail} from '../../test/mock-fetch.ts';
import {NOW} from '../../test/fixtures.ts';
import {fireEvent} from '@testing-library/react-native';
import {createTestApp,renderApp} from '../../test/render.tsx';
import {AssistantWidget} from './AssistantWidget.tsx';
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()})}));
it('opens an explicit assistant entry without creating an identity or sending anything',async()=>{
 const app=createTestApp();const ui=await renderApp(app,<AssistantWidget/>);
 await fireEvent.press(ui.getByLabelText('Ask Fancy'));
 expect(ui.getByText('A little help finding your table.')).toBeTruthy();
 expect(app.services.assistant.credential).toBeNull();expect(app.services.assistant.deviceToken).toBeNull();
 expect(ui.getByText('My preferences')).toBeTruthy();
});
it('keeps overlong native input with inline shortening guidance and recovers at 2000 characters',async()=>{
 const app=createTestApp();const expiresAt=new Date(NOW+1800000).toISOString();
 app.mock.on('POST','/v1/guest-sessions',ok({guestToken:'synthetic-length-guest',expiresAt:new Date(NOW+86400000).toISOString()},201));
 app.mock.on('POST','/v1/ai/sessions',ok({sessionId:'synthetic-ai-session',generation:'1',deviceToken:'synthetic-length-device',revokeHandle:'synthetic-revoke',expiresAt},201));
 app.mock.on('GET','/v1/ai/sessions/synthetic-ai-session',ok({turns:[],latestRequestId:null,expiresAt}));
 app.mock.on('POST','/v1/ai/sessions/synthetic-ai-session/requests',fail(503,'AI_UNAVAILABLE'));
 const ui=await renderApp(app,<AssistantWidget/>);await fireEvent.press(ui.getByLabelText('Ask Fancy'));await fireEvent.press(ui.getByText('Start conversation'));
 const field=await ui.findByLabelText('Ask Fancy a question');expect(field.props.maxLength).toBeUndefined();
 const long='x'.repeat(2001);await fireEvent.changeText(field,long);expect(ui.getByDisplayValue(long)).toBeTruthy();expect(ui.getByText(/Shorten.*2,000/)).toBeTruthy();expect(ui.getByLabelText('Ask').props.accessibilityState.disabled).toBe(true);
 await fireEvent.press(ui.getByLabelText('Ask'));expect(app.mock.callsTo('POST','/v1/ai/sessions/synthetic-ai-session/requests')).toHaveLength(0);
 const boundary='x'.repeat(2000);await fireEvent.changeText(field,boundary);expect(ui.queryByText(/Shorten.*2,000/)).toBeNull();expect(ui.getByLabelText('Ask').props.accessibilityState.disabled).toBe(false);await fireEvent.press(ui.getByLabelText('Ask'));
 expect(app.mock.callsTo('POST','/v1/ai/sessions/synthetic-ai-session/requests')).toHaveLength(1);expect(app.mock.callsTo('POST','/v1/ai/sessions/synthetic-ai-session/requests')[0]?.body).toMatchObject({input:boundary});
 await fireEvent.changeText(field,'   ');expect(ui.getByLabelText('Ask').props.accessibilityState.disabled).toBe(true);
});
it('cold credential-only candidate displays Continue and waits for that explicit action before reading RAM',async()=>{

 // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-only real digest for guest binding
 const {createHash}=require('node:crypto') as {createHash(algorithm:string):{update(value:string):{digest(format:string):string}}};
 const ai=memoryAIConversationStore(),guests=memoryGuestCredentialStore(),token='synthetic-widget-guest';await guests.write({token,expiresAt:NOW+86400000});await ai.write({sessionId:'synthetic-cold-session',generation:1,deviceToken:'synthetic-widget-device',revokeHandle:'synthetic-revoke',expiresAt:NOW+1800000,owner:{kind:'GUEST',credentialSha256:createHash('sha256').update(token).digest('hex')}});
 const app=createTestApp({aiConversationStore:ai,guestStore:guests});await app.services.session.restore();app.mock.on('GET','/v1/ai/sessions/synthetic-cold-session',ok({turns:[{role:'assistant',text:'SERVER_RAM_AFTER_EXPLICIT_CONTINUE'}],latestRequestId:null,expiresAt:new Date(NOW+1800000).toISOString()}));
 const ui=await renderApp(app,<AssistantWidget/>);await fireEvent.press(ui.getByLabelText('Ask Fancy'));await flush();await ui.findByText('Continue conversation');expect(app.mock.callsTo('GET','/v1/ai/sessions/synthetic-cold-session')).toHaveLength(0);expect(ui.queryByText('SERVER_RAM_AFTER_EXPLICIT_CONTINUE')).toBeNull();await fireEvent.press(ui.getByText('Continue conversation'));await ui.findByText('SERVER_RAM_AFTER_EXPLICIT_CONTINUE');expect(app.mock.callsTo('POST','/v1/ai/sessions')).toHaveLength(0);expect(app.mock.callsTo('GET','/v1/ai/sessions/synthetic-cold-session')[0]?.headers).toMatchObject({authorization:`Bearer ${token}`,'ai-device-token':'synthetic-widget-device'});
});
