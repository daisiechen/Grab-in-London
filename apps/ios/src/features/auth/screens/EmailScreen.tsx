import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Keyboard, Text, TextInput, View } from 'react-native';
import { ActionPage, BRAND_PAPER } from '../../../ui/ActionPage.tsx';
import { Primary, TextAction } from '../../../ui/Button.tsx';
import { Field } from '../../../ui/Field.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { createStyles } from '../../../ui/styles.ts';
import { colors, radius } from '../../../ui/tokens.ts';
import { useServices } from '../../../services.tsx';
import { startEmailChallenge, verifyEmailCode, type Challenge } from '../otp.ts';
import { useFinishSignIn } from '../useAuthGate.ts';
import { clearPendingLink, getPendingLink, setPendingLink } from '../link.ts';
import { authText } from './auth-text.ts';

/** Email + six-digit code stages; resend cooldown and expiry come from the server challenge (clock: services.now). */
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
  const remaining = challenge ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000)) : 0;

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
    const generation=services.session.generation;
    Keyboard.dismiss();
    setBusy(true);
    const res = await verifyEmailCode(services, challenge, code, services.now());
    setBusy(false);
    if(generation!==services.session.generation)return;
    if (res.kind === 'signedIn') return finish(res.session,res.authProof);
    if (res.kind === 'linkRequired') {
      if(getPendingLink(services.now())){
        clearPendingLink();
        setIssue({text:"Use the sign-in method already linked to your original account. Start again.",tone:"error"});
        return;
      }
      setPendingLink({linkTicket:res.linkTicket,appVerifier:res.appVerifier,expiresAt:res.expiresAt},services.now(),services.newId());
      return router.push('/link-required');
    }
    if (res.kind === 'retry' || res.kind === 'failed') setIssue({ text: res.message, tone: 'error' });
  };

  const footer = challenge
    ? <Primary label="Verify & continue" icon="ArrowRight" busy={busy} onPress={() => void verify()} />
    : <Primary label="Send code" icon="ArrowRight" busy={busy} onPress={() => void send()} />;

  return (
    <ActionPage testID="email-sign-in" paper footer={footer}>
      <Stack.Screen options={{ headerStyle: { backgroundColor: BRAND_PAPER }, headerShadowVisible: false }} />
      <Text style={authText.eyebrow}>YOUR NEXT TABLE STARTS HERE</Text>
      <Text accessibilityRole="header" style={authText.h1}>{challenge ? 'Check your inbox.' : 'Let’s keep in touch.'}</Text>
      <Text style={authText.prose}>{challenge ? `Enter the six-digit code for ${challenge.email}.` : 'We’ll use a one-time code, so there’s no password to remember.'}</Text>
      {!challenge ? (
        <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" placeholder="alex@example.com" returnKeyType="send" autoFocus onSubmitEditing={() => void send()} />
      ) : (
        <View style={styles.codeWrap}>
          <Text style={styles.label}>6-digit code</Text>
          <TextInput
            accessibilityLabel="6-digit code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            placeholderTextColor="#c3c8bf"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void verify()}
            style={styles.code}
          />
          <Text style={styles.hint}>{remaining > 0 ? `Code expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : 'This code has expired. Request a new code.'}</Text>
          <View style={styles.row}>
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
        </View>
      )}
      <View style={styles.message}><FormMessage message={issue?.text ?? null} tone={issue?.tone ?? 'error'} /></View>
      {getPendingLink(services.now())?<TextAction label="Cancel account link" disabled={busy} onPress={()=>{clearPendingLink();router.replace('/sign-in');}}/>:null}
    </ActionPage>
  );
}

const styles = createStyles({
  codeWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink },
  code: { height: 56, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#fffdf7', fontSize: 26, letterSpacing: 10, textAlign: 'center', color: colors.ink, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 11, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  message: { marginTop: 8 },
});
