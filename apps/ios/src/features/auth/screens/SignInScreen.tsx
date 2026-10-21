import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { BRAND_COPY } from '../../../ui/brand.ts';
import { Primary, TextAction } from '../../../ui/Button.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { Screen } from '../../../ui/Screen.tsx';
import { Sheet } from '../../../ui/Sheet.tsx';
import { Body, Eyebrow, Heading } from '../../../ui/Text.tsx';
import { useServices } from '../../../services.tsx';
import { AUTH_REDIRECT_URL } from '../../../config.ts';
import { signInWithProvider, type Provider } from '../oauth.ts';
import { useFinishSignIn } from '../useAuthGate.ts';
import { setPendingLink } from '../link.ts';

/** Account stage of the prototype BrandEntrance, with real system-browser providers. */
export function SignInScreen() {
  const services = useServices();
  const router = useRouter();
  const finish = useFinishSignIn();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  const provider = async (p: Provider) => {
    setBusy(p);
    setIssue(null);
    const result = await signInWithProvider(p, { ...services, redirectUrl: AUTH_REDIRECT_URL });
    setBusy(null);
    if (result.kind === 'signedIn') finish(result.session);
    else if (result.kind === 'linkRequired') {
      setPendingLink({ linkTicket: result.linkTicket, expiresAt: result.expiresAt });
      router.push('/link-required');
    } else if (result.kind === 'failed') setIssue(result.message);
  };

  return (
    <Screen testID="sign-in">
      <Eyebrow>YOUR NEXT TABLE STARTS HERE</Eyebrow>
      <Heading>Good to meet you.</Heading>
      <Body>Join a table, or come back for another.</Body>
      <View style={{ gap: 10 }}>
        <Primary label="Continue with email" onPress={() => router.push('/email')} disabled={busy !== null} />
        <Primary secondary label="Continue with Google" busy={busy === 'GOOGLE'} disabled={busy !== null} onPress={() => void provider('GOOGLE')} />
        <Primary secondary label="Continue with Apple" busy={busy === 'APPLE'} disabled={busy !== null} onPress={() => void provider('APPLE')} />
      </View>
      <FormMessage message={issue} />
      <TextAction label="Privacy & community principles" onPress={() => setShowTerms(true)} />
      <TextAction label="Keep exploring without an account" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Body muted>{BRAND_COPY.slogan}</Body>
      <Sheet visible={showTerms} title="Community & privacy principles" onClose={() => setShowTerms(false)}>
        <Body>Adults 18+ meet for friendship over meals. Respect boundaries and dietary needs. No harassment or unsolicited pitches.</Body>
        <Body>Your name, photo and introduction are public to other members; your email is private.</Body>
      </Sheet>
    </Screen>
  );
}
