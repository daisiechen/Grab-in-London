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
