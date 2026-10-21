import {screen} from '@testing-library/react-native';
import {Text} from 'react-native';
import {Screen} from './Screen.tsx';
import {createTestApp,renderApp} from '../test/render.tsx';

// Native geometry is independently checked in the Release simulator. This regression
// keeps the shared page wired to UIKit's measured header inset instead of fixed pixels.
test('scrollable pages delegate native header insets while preserving keyboard behavior',async()=>{
 await renderApp(createTestApp(),<Screen><Text>Page heading</Text></Screen>);
 let scroll=screen.getByText('Page heading').parent;
 while(scroll&&scroll.props.keyboardDismissMode!=='interactive')scroll=scroll.parent;
 if(!scroll)throw new Error('Heading must be inside the shared scroll view');
 expect(scroll.props.contentInsetAdjustmentBehavior).toBe('automatic');
 expect(scroll.props.keyboardDismissMode).toBe('interactive');
 expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');

 expect(screen.getByText('Page heading')).toBeTruthy();
});
