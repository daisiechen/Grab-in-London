import {StyleSheet,Text} from 'react-native';
import {screen,within,fireEvent} from '@testing-library/react-native';
import {createTestApp,renderApp} from '../../test/render.tsx';
import {Sheet} from '../../ui/Sheet.tsx';
import {AssistantWidget} from './AssistantWidget.tsx';
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()})}));
it('puts the whole assistant sheet including its heading and controls inside the keyboard viewport',async()=>{
 const app=createTestApp();await renderApp(app,<AssistantWidget/>);
 await fireEvent.press(screen.getByLabelText('Ask Fancy'));
 const viewport=screen.getByTestId('sheet-keyboard-viewport');
 expect(StyleSheet.flatten(viewport.props.style)).toEqual(expect.objectContaining({flex:1}));
 expect(within(viewport).getByRole('header',{name:'Ask Fancy'})).toBeTruthy();
 expect(within(viewport).getByRole('button',{name:'Close'})).toBeTruthy();
 expect(within(viewport).getByRole('button',{name:'Start conversation'})).toBeTruthy();
});
it('keeps unrelated sheets on their existing modal layout and preserves close',async()=>{
 const onClose=jest.fn();await renderApp(createTestApp(),<Sheet visible title="Existing confirmation" onClose={onClose}><Text>Unchanged content</Text></Sheet>);
 expect(screen.queryByTestId('sheet-keyboard-viewport')).toBeNull();
 await fireEvent.press(screen.getByRole('button',{name:'Close'}));expect(onClose).toHaveBeenCalledTimes(1);
});
