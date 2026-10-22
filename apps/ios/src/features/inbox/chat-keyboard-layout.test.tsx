let mockViewportY=350,mockViewportHeight=432;
jest.mock('react-native',()=>{
 // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolated native measurement fixture
 const actual=jest.requireActual('react-native'),React=require('react');
 return Object.defineProperty(Object.create(actual),'View',{value:React.forwardRef((props:Record<string,unknown>,ref:unknown)=>{React.useImperativeHandle(ref,()=>({measureInWindow:(cb:(x:number,y:number,w:number,h:number)=>void)=>cb(0,mockViewportY,402,mockViewportHeight)}));return React.createElement(actual.View,props);})});
});
// eslint-disable-next-line @typescript-eslint/no-require-imports -- isolated navigation double
jest.mock('expo-router',()=>require('../../test/router.ts').expoRouterMock);
jest.mock('expo-router/react-navigation',()=>({useHeaderHeight:()=>0}));
import {act,fireEvent,screen} from '@testing-library/react-native';
import {Keyboard,StyleSheet} from 'react-native';
import {createTestApp,renderApp,signIn} from '../../test/render.tsx';
import {routeParams} from '../../test/router.ts';
import {CONVERSATION_ID,MEAL_ID} from '../../test/fixtures.ts';
import {page} from '../../test/mock-fetch.ts';
import {conversationKey} from './InboxScreen.tsx';
import {ChatScreen,createKeyboardViewportTracker} from './ChatScreen.tsx';
const keyboard={screenX:0,screenY:590,width:402,height:226};
it('starts uncompressed and uses screen intersection including an ancestor notice',()=>{const publish=jest.fn(),t=createKeyboardViewportTracker(cb=>cb(0,350,402,432),publish);t.refresh();expect(publish).toHaveBeenLastCalledWith(0);t.keyboard(keyboard);expect(publish).toHaveBeenLastCalledWith(192);t.keyboard(null);expect(publish).toHaveBeenLastCalledWith(0);});
it('remeasures same-height ancestor movement and notice disappearance while keyboard remains shown',()=>{let y=350,height=432;const publish=jest.fn(),t=createKeyboardViewportTracker(cb=>cb(0,y,402,height),publish);t.keyboard(keyboard);expect(publish).toHaveBeenLastCalledWith(192);y=150;t.refresh();expect(publish).toHaveBeenLastCalledWith(0);height=632;t.refresh();expect(publish).toHaveBeenLastCalledWith(192);});
it('rejects old layout callbacks, hide races, blur and unmount responses',()=>{const pending:Array<(x:number,y:number,w:number,h:number)=>void>=[],publish=jest.fn(),t=createKeyboardViewportTracker(cb=>pending.push(cb),publish);t.keyboard(keyboard);t.refresh();pending[1]!(0,350,402,432);pending[0]!(0,0,402,400);expect(publish.mock.calls).toEqual([[192]]);t.refresh();t.keyboard(null);pending[2]!(0,350,402,432);expect(publish).toHaveBeenLastCalledWith(0);t.keyboard(keyboard);t.stop();pending[3]!(0,350,402,432);expect(publish).toHaveBeenLastCalledWith(0);t.start();t.keyboard(keyboard);pending[4]!(0,350,402,432);expect(publish).toHaveBeenLastCalledWith(192);});
it('clamps overlap and ignores floating keyboards outside the viewport horizontally',()=>{const publish=jest.fn(),t=createKeyboardViewportTracker(cb=>cb(0,350,402,432),publish);t.keyboard({...keyboard,screenY:100,height:716});expect(publish).toHaveBeenLastCalledWith(432);t.keyboard({...keyboard,screenX:500});expect(publish).toHaveBeenLastCalledWith(0);t.keyboard({...keyboard,height:0});expect(publish).toHaveBeenLastCalledWith(0);t.keyboard({...keyboard,screenY:0});expect(publish).toHaveBeenLastCalledWith(0);});

it('wires keyboard and real viewport layout changes to rendered padding and cleans up on blur/unmount',async()=>{
 const callbacks=new Map<string,()=>void>(),removers:Array<jest.Mock>=[];
 const listener=jest.spyOn(Keyboard,'addListener').mockImplementation((event,cb)=>{callbacks.set(event,()=>cb({duration:250,easing:'keyboard',startCoordinates:keyboard,endCoordinates:keyboard,isEventFromThisApp:true}));const remove=jest.fn();removers.push(remove);return {remove};});
 const app=createTestApp();await signIn(app);routeParams.current={conversationId:CONVERSATION_ID};app.services.cache.set(conversationKey(CONVERSATION_ID),{id:CONVERSATION_ID,version:'1',kind:'GROUP',mealId:MEAL_ID,title:'Measured chat',canSend:true,dissolved:false,head:'0'});app.mock.on('GET',`/v1/conversations/${CONVERSATION_ID}/messages`,page([]));
 const tree=await renderApp(app,<ChatScreen/>);await screen.findByText('Measured chat');const padding=()=>StyleSheet.flatten(screen.getByTestId('chat-keyboard-viewport').props.style).paddingBottom;expect(padding()).toBe(0);
 await act(async()=>callbacks.get('keyboardWillShow')?.());expect(padding()).toBe(192);
 mockViewportY=150;mockViewportHeight=632;await fireEvent(screen.getByTestId('chat-keyboard-viewport'),'layout',{nativeEvent:{layout:{x:0,y:0,width:402,height:632}}});expect(padding()).toBe(192);
 mockViewportHeight=432;await fireEvent(screen.getByTestId('chat-keyboard-viewport'),'layout',{nativeEvent:{layout:{x:0,y:0,width:402,height:432}}});expect(padding()).toBe(0);
 await act(async()=>callbacks.get('keyboardWillHide')?.());expect(padding()).toBe(0);await tree.unmount();expect(removers.every(remove=>remove.mock.calls.length===1)).toBe(true);listener.mockRestore();
});
