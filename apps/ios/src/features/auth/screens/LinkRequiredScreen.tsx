import { useRouter } from 'expo-router';
import { Primary } from '../../../ui/Button.tsx';
import { Screen } from '../../../ui/Screen.tsx';
import { Body, Heading } from '../../../ui/Text.tsx';
import { clearPendingLink } from '../link.ts';

export function LinkRequiredScreen() {
  const router = useRouter();
  return (
    <Screen testID="link-required">
      <Heading>You already have an account.</Heading>
      <Body>This email is linked to an existing Fancy account. Sign in the way you did before to keep one account — we won’t create a second one.</Body>
      <Primary
        label="Back to sign-in"
        onPress={() => {
          clearPendingLink();
          router.replace('/sign-in');
        }}
      />
    </Screen>
  );
}
