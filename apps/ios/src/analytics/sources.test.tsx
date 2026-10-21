import { act,fireEvent,screen,waitFor } from '@testing-library/react-native';
import { AppState,View,type AppStateStatus } from 'react-native';
import { AnalyticsConsent } from './Consent.tsx';
import { DiscoverScreen } from '../features/discover/DiscoverScreen.tsx';
import { CreateStepScreen } from '../features/create/CreateStepScreen.tsx';
import { MealDetailScreen } from '../features/meals/MealDetailScreen.tsx';
import { PublicProfileScreen } from '../features/profile/screens/PublicProfileScreen.tsx';
import { ChatScreen } from '../features/inbox/ChatScreen.tsx';
import { conversationKey } from '../features/inbox/InboxScreen.tsx';
import { createTestApp,renderApp,signIn } from '../test/render.tsx';
import { ok,page } from '../test/mock-fetch.ts';
import { meal,me,publicProfile,HOST_ID,MEAL_ID,CONVERSATION_ID } from '../test/fixtures.ts';
import { resetRouter,routeParams } from '../test/router.ts';
import { formErrorProperties,serverFormErrors } from './form-errors.ts';
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-router',()=>require('../test/router.ts').expoRouterMock);
const scope='a'.repeat(43)+'.'+'b'.repeat(43);
let listeners:Set<(state:AppStateStatus)=>void>;
beforeEach(()=>{resetRouter();listeners=new Set();Object.defineProperty(AppState,'currentState',{value:'active',writable:true,configurable:true});jest.spyOn(AppState,'addEventListener').mockImplementation((_type,listener)=>{listeners.add(listener);return{remove:()=>listeners.delete(listener)};});});
afterEach(()=>{jest.restoreAllMocks();jest.useRealTimers();});
async function transition(next:AppStateStatus){await act(async()=>{Object.defineProperty(AppState,'currentState',{value:next,writable:true,configurable:true});for(const listener of listeners)listener(next);});}
describe('native consent and actual source hooks (mock transport)',()=>{
 it('records actual detail presentation with only its public meal ID',async()=>{
  const app=createTestApp();await app.services.session.restore();routeParams.current={mealId:MEAL_ID};
  app.mock.on('GET',`/v1/meals/${MEAL_ID}`,ok({meal:meal(),myApplication:null,conversationId:null}));
  app.mock.on('POST','/v1/analytics/events',{...ok({results:[]}),headers:{'x-fancy-analytics-scope':scope}});
  await app.services.analytics.choose(true);await renderApp(app,<MealDetailScreen/>);
  await waitFor(()=>expect(app.mock.calls.some(call=>JSON.stringify(call.body)?.includes('detail_view'))).toBe(true));
  const body=app.mock.calls.find(call=>JSON.stringify(call.body)?.includes('detail_view'))!.body as {events:{properties:unknown}[]};expect(body.events[0]?.properties).toEqual({mealId:MEAL_ID});
 });
 it('records public profile presentation without profile text',async()=>{
  const app=createTestApp();await app.services.session.restore();routeParams.current={userId:HOST_ID};
  app.mock.on('GET',`/v1/profiles/${HOST_ID}`,ok({profile:publicProfile(),reviews:[],nextReviewCursor:null}));
  app.mock.on('POST','/v1/analytics/events',{...ok({results:[]}),headers:{'x-fancy-analytics-scope':scope}});
  await app.services.analytics.choose(true);await renderApp(app,<PublicProfileScreen/>);
  await waitFor(()=>expect(app.mock.calls.some(call=>JSON.stringify(call.body)?.includes('profile_view'))).toBe(true));
  const body=app.mock.calls.find(call=>JSON.stringify(call.body)?.includes('profile_view'))!.body as {events:{properties:unknown}[]};expect(body.events[0]?.properties).toEqual({userId:HOST_ID});
 });
 it('records an authorised group opening after a successful empty message response',async()=>{
  const app=createTestApp();await signIn(app,me());routeParams.current={conversationId:CONVERSATION_ID};
  app.services.cache.set(conversationKey(CONVERSATION_ID),{id:CONVERSATION_ID,version:'1',kind:'GROUP',mealId:MEAL_ID,title:'Sunday dinner',canSend:true,dissolved:false,head:'0'});
  app.mock.on('GET',`/v1/conversations/${CONVERSATION_ID}/messages`,page([]));
  app.mock.on('POST','/v1/analytics/events',{...ok({results:[]}),headers:{'x-fancy-analytics-scope':scope}});
  await app.services.analytics.choose(true);await renderApp(app,<ChatScreen/>);
  await waitFor(()=>expect(app.mock.calls.some(call=>JSON.stringify(call.body)?.includes('chat_opened'))).toBe(true));
  const body=app.mock.calls.find(call=>JSON.stringify(call.body)?.includes('chat_opened'))!.body as {events:{properties:unknown}[]};expect(body.events[0]?.properties).toEqual({conversationId:CONVERSATION_ID});
 });
 it('refreshes discovery only after acknowledged consent and records a continuous foreground impression bound to its real response ID',async()=>{
  const app=createTestApp();await app.services.session.restore();let requests=0;
  app.mock.on('GET','/v1/meals',()=>({...page([meal()]),body:{...(page([meal()]).body as object),meta:{requestId:`11111111-1111-4111-8111-${String(++requests).padStart(12,'0')}`,serverNow:new Date(app.services.now()).toISOString()}}}));
  app.mock.on('POST','/v1/analytics/events',{...ok({results:[]}),headers:{'x-fancy-analytics-scope':scope}});
  await renderApp(app,<View><AnalyticsConsent manager={app.services.analytics}/><DiscoverScreen/></View>);
  await screen.findByText('Sunday dinner');expect(app.mock.callsTo('POST','/v1/analytics/events')).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button',{name:'Allow analytics'}));
  await waitFor(()=>expect(app.mock.callsTo('GET','/v1/meals').some(call=>call.headers['x-fancy-analytics']==='enabled'&&call.headers.cookie===`fancy_analytics_scope=${scope}`)).toBe(true));
  await waitFor(()=>expect(app.mock.callsTo('POST','/v1/analytics/events').some(call=>JSON.stringify(call.body).includes('discovery_results'))).toBe(true));
  const rendered=app.mock.callsTo('POST','/v1/analytics/events').find(call=>JSON.stringify(call.body).includes('discovery_results'))!.body as {events:{properties:{discoveryRequestId:string}}[]};
  expect(rendered.events[0]?.properties.discoveryRequestId).toBe('11111111-1111-4111-8111-000000000002');
  jest.useFakeTimers();
  await fireEvent(screen.getByTestId('discover-list'),'viewableItemsChanged',{viewableItems:[{isViewable:true,item:meal()}]});
  await act(async()=>{jest.advanceTimersByTime(600);});await transition('background');
  await act(async()=>{jest.advanceTimersByTime(1200);});
  expect(app.mock.calls.some(call=>JSON.stringify(call.body)?.includes('meal_impression'))).toBe(false);
  await transition('active');await act(async()=>{jest.advanceTimersByTime(1000);});
  const impression=app.mock.calls.find(call=>JSON.stringify(call.body)?.includes('meal_impression'))?.body as {events:{properties:Record<string,unknown>}[]};
  expect(impression.events[0]?.properties).toMatchObject({discoveryRequestId:'11111111-1111-4111-8111-000000000002',durationMs:1000,foreground:true,eligible:true});
  expect(app.mock.calls.some(call=>JSON.stringify(call.body)?.includes('map_opened'))).toBe(false);
 });
 it('captures fixed form errors without private input text and clears scope on logout',async()=>{
  const app=createTestApp();await signIn(app,me());
  app.mock.on('POST','/v1/analytics/events',{...ok({results:[]}),headers:{'x-fancy-analytics-scope':scope}});
  await app.services.analytics.choose(true);
  await renderApp(app,<CreateStepScreen step={0}/>);
  await fireEvent.press(screen.getByRole('button',{name:'Continue'}));
  await waitFor(()=>expect(app.mock.calls.some(call=>JSON.stringify(call.body)?.includes('form_error'))).toBe(true));
  const events=JSON.stringify(app.mock.calls.filter(call=>call.path==='/v1/analytics/events').map(call=>call.body));
  expect(events).toContain('"field":"venue"');expect(events).not.toContain('Choose a restaurant');
  await act(async()=>{app.services.analytics.clear();});expect(app.services.analytics.headersFor('discoverMeals')).toEqual({'x-fancy-analytics':'disabled'});
  expect(formErrorProperties('id','PRIVATE TEXT')).toBeNull();
  expect(serverFormErrors('id',{description:'PRIVATE TEXT',unknown:'PRIVATE TEXT'})).toEqual([{attemptId:'id',step:'introduce',field:'description',errorCode:'invalid'}]);
 });
});
