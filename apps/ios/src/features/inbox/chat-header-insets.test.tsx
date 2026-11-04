import {fireEvent,screen,waitFor} from '@testing-library/react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
import {StyleSheet} from 'react-native';
import {ChatScreen} from './ChatScreen.tsx';
import {conversationKey} from './InboxScreen.tsx';
import {createTestApp,renderApp,signIn} from '../../test/render.tsx';
import {routeParams,resetRouter} from '../../test/router.ts';
import {CONVERSATION_ID,MEAL_ID} from '../../test/fixtures.ts';
import {page} from '../../test/mock-fetch.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock factory uses the shared router double
jest.mock('expo-router',()=>require('../../test/router.ts').expoRouterMock);

beforeEach(()=>{resetRouter();routeParams.current={conversationId:CONVERSATION_ID};});
// The chat hides the native header and draws the demo page header itself, right under the safe area.
for(const top of [0,47,59])test(`chat starts right under a ${top}pt safe area without changing leave or composer`,async()=>{
 const app=createTestApp();await signIn(app);
 app.services.cache.set(conversationKey(CONVERSATION_ID),{id:CONVERSATION_ID,version:'4',kind:'GROUP',mealId:MEAL_ID,title:'Shared table',canSend:true,dissolved:false,head:'0'});
 app.mock.on('GET',`/v1/conversations/${CONVERSATION_ID}/messages`,page([]));
 await renderApp(app,<SafeAreaInsetsContext.Provider value={{top,left:0,right:0,bottom:34}}><ChatScreen/></SafeAreaInsetsContext.Provider>);
 await waitFor(()=>expect(screen.getByLabelText('Message')).toBeTruthy());
 const root=screen.getByTestId('chat');
 expect(StyleSheet.flatten(root.props.style).paddingTop).toBe(top);
 expect(screen.getByRole('header',{name:'Shared table'})).toBeTruthy();
 await fireEvent.press(screen.getByRole('button',{name:'Open group settings'}));
 expect(screen.getByRole('button',{name:'Leave group'})).toBeTruthy();
});
