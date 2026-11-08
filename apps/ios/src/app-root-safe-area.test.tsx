import {fireEvent,screen,waitFor,within} from '@testing-library/react-native';
import {Text} from 'react-native';
import {AppRoot} from './AppRoot.tsx';
import {AnalyticsConsent} from './analytics/Consent.tsx';
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
  test('with no notice there is no notices region, so screens start at their own safe-area top',async()=>{
    const app=createTestApp();
    await renderApp(app,<AppRoot services={app.services}><Text testID="navigation-content">Navigation</Text></AppRoot>);
    expect(screen.queryByTestId('app-notices')).toBeNull();
    expect(screen.queryByText('Help improve Fancy')).toBeNull();
    expect(screen.getByTestId('navigation-content')).toBeTruthy();
  });
  test('declining from settings collapses to the preferences control',async()=>{
    const app=createTestApp();app.mock.on('POST','/v1/analytics/events',ok({results:[]}));
    await app.services.session.restore();
    await renderApp(app,<AnalyticsConsent manager={app.services.analytics}/>);
    await fireEvent.press(screen.getByRole('button',{name:'Decline analytics'}));
    await waitFor(()=>expect(app.services.analytics.getState().choice).toBe('declined'));
    expect(screen.getByRole('button',{name:'Analytics preferences'})).toBeTruthy();
    expect(app.services.analytics.getState().enabled).toBe(false);
  });
  test('unavailable-session banner stays in the top notices region',async()=>{
    const app=createTestApp();jest.spyOn(app.store,'readRefresh').mockRejectedValue(new Error('synthetic storage unavailable'));
    await renderApp(app,<AppRoot services={app.services}><Text testID="navigation-content">Navigation</Text></AppRoot>);
    await screen.findByText(/You’re offline or Fancy can’t be reached/);
    expect(notices().getByRole('button',{name:'Try again'})).toBeTruthy();
  });
});
