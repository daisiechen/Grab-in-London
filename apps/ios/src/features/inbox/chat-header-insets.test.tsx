import {screen,waitFor} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';
import {ChatScreen} from './ChatScreen.tsx';
import {conversationKey} from './InboxScreen.tsx';
import {createTestApp,renderApp,signIn} from '../../test/render.tsx';
import {routeParams,resetRouter} from '../../test/router.ts';
import {CONVERSATION_ID,MEAL_ID} from '../../test/fixtures.ts';
import {page} from '../../test/mock-fetch.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory uses the shared router double
jest.mock('expo-router',()=>require('../../test/router.ts').expoRouterMock);
let mockHeaderHeight=0;
jest.mock('expo-router/react-navigation',()=>({useHeaderHeight:()=>mockHeaderHeight}));

beforeEach(()=>{resetRouter();routeParams.current={conversationId:CONVERSATION_ID};});
for(const height of [0,64,96])test(`chat adapts to measured native header ${height} without changing leave or composer`,async()=>{
 mockHeaderHeight=height;
 const app=createTestApp();await signIn(app);
 app.services.cache.set(conversationKey(CONVERSATION_ID),{id:CONVERSATION_ID,version:'4',kind:'GROUP',mealId:MEAL_ID,title:'Shared table',canSend:true,dissolved:false,head:'0'});
 app.mock.on('GET',`/v1/conversations/${CONVERSATION_ID}/messages`,page([]));
 await renderApp(app,<ChatScreen/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Leave group'})).toBeTruthy());
 const root=screen.getByTestId('chat');
 expect(StyleSheet.flatten(root.props.style).paddingTop).toBe(height);
 expect(screen.getByLabelText('Message')).toBeTruthy();
});
