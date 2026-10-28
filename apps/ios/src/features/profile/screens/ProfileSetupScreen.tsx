import { SessionScope } from '../../auth/SessionScope.tsx';
import { useMemo, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Keyboard, Text, View } from 'react-native';
import { ActionPage, BRAND_PAPER } from '../../../ui/ActionPage.tsx';
import { Primary } from '../../../ui/Button.tsx';
import { CheckRow } from '../../../ui/CheckRow.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { createStyles } from '../../../ui/styles.ts';
import { colors } from '../../../ui/tokens.ts';
import { authText } from '../../auth/screens/auth-text.ts';
import { useServices, useSessionState } from '../../../services.tsx';
import { POLICY_VERSION } from '../../../config.ts';
import { takeReturnTo } from '../../auth/intent.ts';
import { useLeaveAuth } from '../../auth/useAuthGate.ts';
import { buildPatch, formFromMe, needsConsent, validateProfile, type ProfileField, type ProfileForm } from '../model.ts';
import { ProfileSaver } from '../save.ts';
import { ProfileFormView } from './ProfileFormView.tsx';

/** profileGate completion for the signed-in user (same user; never creates another account). */
export function ProfileSetupScreen() {
  return <SessionScope><ProfileSetupScreenContent /></SessionScope>;
}

function ProfileSetupScreenContent() {
  const services = useServices();
  const state = useSessionState();
  const router = useRouter();
  const leave = useLeaveAuth();
  const me = state.status === 'signedIn' ? state.session.user : null;
  const [form, setForm] = useState<ProfileForm | null>(me ? formFromMe(me) : null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<{ field: ProfileField | null; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const saver = useMemo(() => new ProfileSaver(services.api, services.session, services.newId), [services]);

  if (!me || !form) {
    return (
      <ActionPage paper footer={<Primary label="Sign in" onPress={() => router.replace('/sign-in')} />}>
        <Text style={authText.prose}>Please sign in to continue.</Text>
      </ActionPage>
    );
  }
  const requireConsent = needsConsent(me);

  const submit = async () => {
    Keyboard.dismiss();
    const invalid = validateProfile(form, { requireConsent, consent });
    if (invalid) return setError(invalid);
    setBusy(true);
    const res = await saver.save(buildPatch(form, { policyVersion: requireConsent ? POLICY_VERSION : null }), me.version);
    setBusy(false);
    if (res.kind === 'saved') {
      setError(null);
      if (res.me.profileGate.profileComplete) leave(takeReturnTo('/'));
      else setError({ field: null, message: 'A few details are still missing.' });
    } else if (res.kind === 'conflict') setError({ field: null, message: res.message });
    else setError({ field: res.kind === 'invalid' ? res.field : null, message: res.message });
  };

  return (
    <ActionPage testID="profile-setup" paper footer={<Primary label="Take your seat" icon="ArrowRight" busy={busy} onPress={() => void submit()} />}>
      <Stack.Screen options={{ headerStyle: { backgroundColor: BRAND_PAPER }, headerShadowVisible: false }} />
      <Text style={authText.eyebrow}>ONE LAST INTRODUCTION</Text>
      <Text accessibilityRole="header" style={authText.h1}>A face. A little story. You.</Text>
      <Text style={authText.prose}>Give your future table a little context. Your email stays private.</Text>
      <ProfileFormView form={form} onChange={setForm} error={error} mode="setup" />
      <Text style={styles.note}>Add work, school, hometown and more interests in Edit profile whenever you like.</Text>
      {requireConsent ? <View style={styles.consent}><CheckRow label="I’m 18 or older and I’ll keep this community welcoming, respectful and friendship-first." checked={consent} onChange={setConsent} /></View> : null}
      <View style={styles.message}><FormMessage message={error?.message ?? null} /></View>
    </ActionPage>
  );
}

const styles = createStyles({
  note: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 14 },
  consent: { marginTop: 10 },
  message: { marginTop: 6 },
});
