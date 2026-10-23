import {useAssistantContext} from '../../assistant/hooks.ts';
import { useRouter } from 'expo-router';
import { Primary } from '../../../ui/Button.tsx';
import { Screen } from '../../../ui/Screen.tsx';
import { Body, Heading } from '../../../ui/Text.tsx';
import { useSessionState } from '../../../services.tsx';
import { rememberReturnTo } from '../../auth/intent.ts';
import { ProfileView } from './ProfileView.tsx';

/** Profile tab: own profile when signed in; guests are invited to sign in (no private data shown). */
export function MyProfileScreen() {
  const state = useSessionState();
  useAssistantContext({sourcePage:'PROFILE'});
  const router = useRouter();
  if (state.status !== 'signedIn') {
    return (
      <Screen testID="profile-guest">
        <Heading>Your profile</Heading>
        <Body>Sign in to set up the profile your tables will see.</Body>
        <Primary
          label="Sign in or create an account"
          onPress={() => {
            rememberReturnTo('/profile');
            router.push('/sign-in');
          }}
        />
        <Primary secondary label="Check deletion status" onPress={() => router.push('/deletion-status')} />
      </Screen>
    );
  }
  const me = state.session.user;
  return (
    <Screen testID="profile-own">
      <ProfileView displayName={me.displayName} bio={me.bio} lifeStatus={me.lifeStatus} languages={me.languages} interests={me.interests} background={me.background} />
      {!me.profileGate.profileComplete ? <Primary label="Finish your profile" onPress={() => router.push('/profile-setup')} /> : null}
      <Primary secondary label="Edit public profile" onPress={() => router.push('/profile-edit')} />
      <Primary secondary label="Settings" onPress={() => router.push('/settings')} />
    </Screen>
  );
}
