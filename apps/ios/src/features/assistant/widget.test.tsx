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
