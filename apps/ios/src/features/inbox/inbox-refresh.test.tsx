import {act,fireEvent,screen,waitFor} from '@testing-library/react-native';
import {InboxScreen} from './InboxScreen.tsx';
import {createTestApp,renderApp,signIn} from '../../test/render.tsx';
import {page,fail} from '../../test/mock-fetch.ts';
import {CONVERSATION_ID,MEAL_ID,me} from '../../test/fixtures.ts';
let mockFocus:(()=>void|(()=>void))|undefined;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest router factory must load its isolated hook double.
jest.mock('expo-router',()=>({...require('../../test/router.ts').expoRouterMock,useFocusEffect:(cb:()=>void|(()=>void))=>{require('react').useEffect(()=>{mockFocus=cb;return cb();},[cb]);}}));
const row={conversation:{id:CONVERSATION_ID,version:'1',kind:'GROUP',mealId:MEAL_ID,title:'Retained chat',canSend:true,dissolved:false,head:'3'},lastMessage:null,unreadCount:1};
it('refetches mounted invalidated inbox on focus after session validation without displaying false zero counts',async()=>{
 const app=createTestApp();await signIn(app,me());const validate=jest.spyOn(app.services.session,'revalidate').mockResolvedValue(app.services.session.getState());
 let resolve!:(value:ReturnType<typeof page>)=>void;const held=new Promise<ReturnType<typeof page>>(r=>{resolve=r;});
 app.mock.on('GET','/v1/inbox',page([row]),1);app.mock.on('GET','/v1/inbox',()=>held);
 await renderApp(app,<InboxScreen/>);await screen.findByRole('button',{name:'Retained chat, 1 unread'});
 expect(app.mock.calls.filter(c=>c.path==='/v1/inbox')).toHaveLength(1);
 await act(async()=>app.services.cache.delete('inbox'));
 expect(screen.queryByRole('tab',{name:'Chats · 0'})).toBeNull();expect(screen.getByText('Loading inbox…')).toBeOnTheScreen();
 await act(async()=>{mockFocus?.();});await waitFor(()=>expect(validate).toHaveBeenCalledTimes(1));await waitFor(()=>expect(app.mock.calls.filter(c=>c.path==='/v1/inbox')).toHaveLength(2));
 await act(async()=>resolve(page([{...row,unreadCount:0}])));expect(await screen.findByRole('button',{name:'Retained chat'})).toBeOnTheScreen();expect(screen.getByRole('tab',{name:'Chats · 1'})).toBeOnTheScreen();
});
it('shows forbidden reload failure and permits an explicit retry without looping or writing',async()=>{
 const app=createTestApp();await signIn(app,me());jest.spyOn(app.services.session,'revalidate').mockResolvedValue(app.services.session.getState());
 app.mock.on('GET','/v1/inbox',page([row]),1);app.mock.on('GET','/v1/inbox',fail(403,'FORBIDDEN'),1);app.mock.on('GET','/v1/inbox',page([]));
 await renderApp(app,<InboxScreen/>);await screen.findByText('Retained chat');await act(async()=>{app.services.cache.delete('inbox');mockFocus?.();});
 expect(await screen.findByText('You don’t have access to this.')).toBeOnTheScreen();expect(screen.queryByRole('tab',{name:'Chats · 0'})).toBeNull();
 expect(app.mock.calls.filter(c=>c.path==='/v1/inbox')).toHaveLength(2);await fireEvent.press(screen.getByRole('button',{name:'Retry loading inbox'}));expect(await screen.findByText('Your next hello starts here.')).toBeOnTheScreen();
 expect(app.mock.calls.filter(c=>c.path==='/v1/inbox')).toHaveLength(3);
});

it('shows a focus validation outage without issuing an unauthorized inbox refetch',async()=>{
 const app=createTestApp();await signIn(app,me());const validate=jest.spyOn(app.services.session,'revalidate').mockResolvedValue({status:'unavailable'});
 app.mock.on('GET','/v1/inbox',page([row]));await renderApp(app,<InboxScreen/>);await screen.findByText('Retained chat');
 await act(async()=>{app.services.cache.delete('inbox');mockFocus?.();});
 expect(await screen.findByText('We couldn’t verify your session. Check your connection and retry loading inbox.')).toBeOnTheScreen();
 expect(app.mock.callsTo('GET','/v1/inbox')).toHaveLength(1);expect(screen.queryByRole('tab',{name:'Chats · 0'})).toBeNull();expect(validate).toHaveBeenCalledTimes(1);
});
it('never repopulates conversation cache from a read completed after session expiry',async()=>{
 const app=createTestApp();await signIn(app,me());let resolve!:(value:ReturnType<typeof page>)=>void;
 app.mock.on('GET','/v1/inbox',()=>new Promise(r=>{resolve=r;}));await renderApp(app,<InboxScreen/>);
 await waitFor(()=>expect(app.mock.callsTo('GET','/v1/inbox')).toHaveLength(1));
 await act(async()=>{await app.services.session.expire();resolve(page([row]));});
 expect(app.services.cache.get('conversation:'+CONVERSATION_ID)).toBeUndefined();expect(screen.queryByText('Retained chat')).toBeNull();
});
