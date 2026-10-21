import { SessionScope } from '../../auth/SessionScope.tsx';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Keyboard } from 'react-native';
import { Primary } from '../../../ui/Button.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { Screen } from '../../../ui/Screen.tsx';
import { Body } from '../../../ui/Text.tsx';
import { useServices, useSessionState } from '../../../services.tsx';
import { buildPatch, formFromMe, validateProfile, type ProfileField, type ProfileForm } from '../model.ts';
import { ProfileSaver } from '../save.ts';
import { ProfileFormView } from './ProfileFormView.tsx';

export function EditProfileScreen() {
  return <SessionScope><EditProfileScreenContent /></SessionScope>;
}

function EditProfileScreenContent() {
  const services = useServices();
  const state = useSessionState();
  const router = useRouter();
  const me = state.status === 'signedIn' ? state.session.user : null;
  const [form, setForm] = useState<ProfileForm | null>(me ? formFromMe(me) : null);
  const [error, setError] = useState<{ field: ProfileField | null; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const saver = useMemo(() => new ProfileSaver(services.api, services.session, services.newId), [services]);
  if (!me || !form) return <Screen><Body>Please sign in to edit your profile.</Body></Screen>;

  const save = async () => {
    Keyboard.dismiss();
    const invalid = validateProfile(form, { requireConsent: false, consent: false });
    if (invalid) return setError(invalid);
    setBusy(true);
    const res = await saver.save(buildPatch(form, { policyVersion: null }), me.version);
    setBusy(false);
    if (res.kind === 'saved') return router.back();
    // Conflict keeps the user's edits on screen; the refreshed version is used for the next save.
    setError({ field: res.kind === 'invalid' ? res.field : null, message: res.message });
  };

  return (
    <Screen testID="profile-edit">
      <ProfileFormView form={form} onChange={setForm} error={error} mode="edit" />
      <FormMessage message={error?.message ?? null} />
      <Primary label="Save profile" busy={busy} onPress={() => void save()} />
    </Screen>
  );
}
