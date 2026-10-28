import { SessionScope } from '../../auth/SessionScope.tsx';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Keyboard } from 'react-native';
import { Primary } from '../../../ui/Button.tsx';
import { CheckRow } from '../../../ui/CheckRow.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { Screen } from '../../../ui/Screen.tsx';
import { Body, Eyebrow, Heading } from '../../../ui/Text.tsx';
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
      <Screen>
        <Body>Please sign in to continue.</Body>
        <Primary label="Sign in" onPress={() => router.replace('/sign-in')} />
      </Screen>
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
    <Screen testID="profile-setup">
      <Eyebrow>ONE LAST INTRODUCTION</Eyebrow>
      <Heading>A face. A little story. You.</Heading>
      <Body>Give your future table a little context. Your email stays private.</Body>
      <ProfileFormView form={form} onChange={setForm} error={error} mode="setup" />
      <Body muted>Add work, school, hometown and more interests in Edit profile whenever you like.</Body>
      {requireConsent ? <CheckRow label="I’m 18 or older and I’ll keep this community welcoming, respectful and friendship-first." checked={consent} onChange={setConsent} /> : null}
      <FormMessage message={error?.message ?? null} />
      <Primary label="Take your seat" busy={busy} onPress={() => void submit()} />
    </Screen>
  );
}