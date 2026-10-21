import { useRouter } from 'expo-router';
import { Primary } from '../../../ui/Button.tsx';
import { Screen } from '../../../ui/Screen.tsx';
import { Body, Heading } from '../../../ui/Text.tsx';

/**
 * Reached only if iOS delivers the auth deep link outside the active ASWebAuthenticationSession
 * (e.g. the app was killed mid sign-in). The one-time verifier lived in memory, so the code cannot be
 * redeemed here; the user starts again rather than us reusing any token.
 */
export function AuthCallbackScreen() {
  const router = useRouter();
  return (
    <Screen testID="auth-callback">
      <Heading>Sign-in didn’t finish.</Heading>
      <Body>Please start again. For your security, an interrupted sign-in can’t be resumed.</Body>
      <Primary label="Back to sign-in" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
