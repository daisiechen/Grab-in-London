import {fireEvent,screen,waitFor,within} from '@testing-library/react-native';
import {Text} from 'react-native';
import {AppRoot} from './AppRoot.tsx';
import {createTestApp,renderApp} from './test/render.tsx';
import {ok} from './test/mock-fetch.ts';
jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()})}));

function notices() {
  const region=screen.getByTestId('app-notices');
  expect(region.props.edges).toEqual({top:'additive',left:'additive',right:'additive',bottom:'off'});
  expect(within(region).queryByTestId('navigation-content')).toBeNull();
  expect(within(region).queryByRole('button',{name:'Ask Fancy'})).toBeNull();
  return within(region);
}

describe('application notices safe area',()=>{
  test('initial analytics choice shares a top and horizontal safe area outside navigation',async()=>{
    const app=createTestApp();
    await renderApp(app,<AppRoot services={app.services}><Text testID="navigation-content">Navigation</Text></AppRoot>);
    expect(notices().getByText('Help improve Fancy')).toBeTruthy();
    expect(screen.getByTestId('navigation-content')).toBeTruthy();
  });
  test('declining keeps the collapsed preferences control in the same safe region',async()=>{
    const app=createTestApp();app.mock.on('POST','/v1/analytics/events',ok({results:[]}));
    await renderApp(app,<AppRoot services={app.services}><Text testID="navigation-content">Navigation</Text></AppRoot>);
    await fireEvent.press(screen.getByRole('button',{name:'Decline analytics'}));
    await waitFor(()=>expect(app.services.analytics.getState().choice).toBe('declined'));
    expect(notices().getByRole('button',{name:'Analytics preferences'})).toBeTruthy();
    expect(app.services.analytics.getState().enabled).toBe(false);
  });
  test('unavailable-session banner shares that region instead of adding another top inset',async()=>{
    const app=createTestApp();jest.spyOn(app.store,'readRefresh').mockRejectedValue(new Error('synthetic storage unavailable'));
    await renderApp(app,<AppRoot services={app.services}><Text testID="navigation-content">Navigation</Text></AppRoot>);
    await screen.findByText(/You’re offline or Fancy can’t be reached/);
    expect(notices().getByRole('button',{name:'Try again'})).toBeTruthy();
    expect(notices().getByText('Help improve Fancy')).toBeTruthy();
  });
});
