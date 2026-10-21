import {AppState,type AppStateStatus} from 'react-native';
import {act,waitFor} from '@testing-library/react-native';
import {createTestApp,renderApp,signIn} from '../../test/render.tsx';
import {ok} from '../../test/mock-fetch.ts';
import {NOW} from '../../test/fixtures.ts';
import {AssistantWidget} from './AssistantWidget.tsx';
import {emptyPreferences} from './manager.ts';
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()})}));
it('QA-AI-026 foreground validates account preference epoch before retaining old assistant context and preserves unsent text',async()=>{
 const listeners:Array<(state:AppStateStatus)=>void>=[];
 const spy=jest.spyOn(AppState,'addEventListener').mockImplementation((_event,listener)=>{listeners.push(listener);return {remove:()=>{}};});
 try{
  const app=createTestApp();await signIn(app);const expiresAt=new Date(NOW+1800000).toISOString();
  app.mock.on('GET','/v1/ai/preferences',ok({fields:{...emptyPreferences(),budgetMaxPence:3500},version:'1',epoch:'1',confirmedAt:new Date(NOW).toISOString()}),1);
  app.mock.on('POST','/v1/ai/sessions',ok({sessionId:'synthetic-resume-session',generation:'1',deviceToken:'synthetic-resume-device',revokeHandle:'synthetic-revoke',expiresAt},201));
  app.mock.on('GET','/v1/ai/sessions/synthetic-resume-session',ok({turns:[{role:'assistant',text:'OLD_PREFERENCE_CONTEXT'}],latestRequestId:null,expiresAt}));
  const ui=await renderApp(app,<AssistantWidget/>);
  await act(async()=>{app.services.assistant.open();await app.services.assistant.continue();app.services.assistant.setText('UNSENT_MUST_REMAIN');});
  expect(app.mock.callsTo('GET','/v1/ai/preferences')).toHaveLength(1);expect(ui.getByText('OLD_PREFERENCE_CONTEXT')).toBeTruthy();
  await act(async()=>{for(const listener of listeners)listener('background');});
  app.mock.on('GET','/v1/ai/preferences',ok({fields:emptyPreferences(),version:'2',epoch:'2',confirmedAt:null}));
  await act(async()=>{for(const listener of listeners)listener('active');});
  await waitFor(()=>expect(app.mock.callsTo('GET','/v1/ai/preferences').length).toBeGreaterThan(1));
  expect(app.services.assistant.getSnapshot().preferences).toEqual(emptyPreferences());
  expect(ui.queryByText('OLD_PREFERENCE_CONTEXT')).toBeNull();expect(app.services.assistant.getSnapshot().text).toBe('UNSENT_MUST_REMAIN');
 }finally{spy.mockRestore();}
});
