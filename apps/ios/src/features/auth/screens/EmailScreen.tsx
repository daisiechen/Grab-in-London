import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Keyboard, View } from 'react-native';
import { Primary, TextAction } from '../../../ui/Button.tsx';
import { Field } from '../../../ui/Field.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { Screen } from '../../../ui/Screen.tsx';
import { Body, Eyebrow, Heading } from '../../../ui/Text.tsx';
import { useServices } from '../../../services.tsx';
import { startEmailChallenge, verifyEmailCode, type Challenge } from '../otp.ts';
import { useFinishSignIn } from '../useAuthGate.ts';
import { setPendingLink } from '../link.ts';

/** Email + six-digit code stages; resend cooldown and expiry come from the server challenge. */
export function EmailScreen() {
  const services = useServices();
  const router = useRouter();
  const finish = useFinishSignIn();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [issue, setIssue] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(services.now());

  useEffect(() => {
    if (!challenge) return;
    const id = setInterval(() => setNow(services.now()), 1000);
    return () => clearInterval(id);
  }, [challenge, services]);

  const cooldown = challenge ? Math.max(0, Math.ceil((challenge.resendAfter - now) / 1000)) : 0;

  const send = async () => {
    Keyboard.dismiss();
    setBusy(true);
    const res = await startEmailChallenge(services.api, email, services.newId);
    setBusy(false);
    if (!res.ok) return setIssue({ text: res.message, tone: 'error' });
    setChallenge(res.challenge);
    setEmail(res.challenge.email);
    setCode('');
    setNow(services.now());
    setIssue(challenge ? { text: 'A new code is on its way.', tone: 'info' } : null);
  };

  const verify = async () => {
    if (!challenge) return;
    Keyboard.dismiss();
    setBusy(true);
    const res = await verifyEmailCode(services, challenge, code, services.now());
    setBusy(false);
    if (res.kind === 'signedIn') return finish(res.session);
    if (res.kind === 'linkRequired') {
      setPendingLink({ linkTicket: res.linkTicket, expiresAt: res.expiresAt });
      return router.push('/link-required');
    }
    if (res.kind === 'retry' || res.kind === 'failed') setIssue({ text: res.message, tone: 'error' });
  };

  return (
    <Screen testID="email-sign-in">
      <Eyebrow>YOUR NEXT TABLE STARTS HERE</Eyebrow>
      <Heading>{challenge ? 'Check your inbox.' : 'Let’s keep in touch.'}</Heading>
      <Body>{challenge ? `Enter the six-digit code for ${challenge.email}.` : 'We’ll use a one-time code, so there’s no password to remember.'}</Body>
      {!challenge ? (
        <View style={{ gap: 14 }}>
          <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" placeholder="alex@example.com" returnKeyType="send" onSubmitEditing={() => void send()} />
          <Primary label="Send code" busy={busy} onPress={() => void send()} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Field label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} placeholder="123456" />
          <Primary label="Verify & continue" busy={busy} onPress={() => void verify()} />
          <TextAction label={cooldown ? `Resend in ${cooldown}s` : 'Resend code'} disabled={cooldown > 0 || busy} onPress={() => void send()} />
          <TextAction
            label="Change email"
            onPress={() => {
              setChallenge(null);
              setCode('');
              setIssue(null);
            }}
          />
        </View>
      )}
      <FormMessage message={issue?.text ?? null} tone={issue?.tone ?? 'error'} />
    </Screen>
  );
}
