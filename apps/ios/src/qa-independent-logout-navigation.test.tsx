import {act,fireEvent,screen,waitFor} from '@testing-library/react-native';
import {Text} from 'react-native';
import {AppRoot} from './AppRoot.tsx';
import {SettingsScreen} from './features/settings/SettingsScreen.tsx';
import {useSessionState} from './services.tsx';
import {createTestApp,renderApp,signIn} from './test/render.tsx';
import {deferred} from './test/deferred.ts';
import {fail,noContent,networkDown,type MockReply} from './test/mock-fetch.ts';
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn(),replace:jest.fn()})}));
function Navigation(){const state=useSessionState();return state.status==='signedIn'?<SettingsScreen/>:<Text>Guest home</Text>;}
async function start(){const app=createTestApp();await renderApp(app,<AppRoot services={app.services}><Navigation/></AppRoot>);await waitFor(()=>expect(app.services.session.getState().status).toBe('signedOut'));await act(()=>signIn(app));return app;}
async function logout(){await fireEvent.press(screen.getByRole('button',{name:'Sign out'}));const actions=screen.getAllByRole('button',{name:'Sign out'});await fireEvent.press(actions[actions.length-1]!);await screen.findByText('Guest home');}
it.each(['network','503'] as const)('QA-F46: retains truthful remote-unconfirmed notice after actual Settings unmount for %s',async(mode)=>{
 const app=await start(),response=deferred<MockReply>();app.mock.on('POST','/v1/auth/logout',()=>response.promise);
 await logout();expect(screen.queryByText('Your account')).toBeNull();expect(app.store.value).toBeNull();
 expect(screen.queryByText(/Fancy hasn’t confirmed/)).toBeNull();
 await act(async()=>{if(mode==='network'){try{networkDown();}catch(error){response.reject(error);}}else response.resolve(fail(503,'UNAVAILABLE'));});
 const notices=screen;
 expect(await notices.findByText(/Fancy hasn’t confirmed that the remote session ended/)).toBeTruthy();
 expect(app.services.session.getState().status).toBe('signedOut');
 expect(app.mock.callsTo('POST','/v1/auth/logout')).toHaveLength(1);
 await fireEvent.press(notices.getByRole('button',{name:'Dismiss sign-out notice'}));expect(screen.queryByText(/Fancy hasn’t confirmed/)).toBeNull();
});
