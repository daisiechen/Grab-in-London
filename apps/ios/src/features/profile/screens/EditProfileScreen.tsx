import { SessionScope } from '../../auth/SessionScope.tsx';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Keyboard, Text, View } from 'react-native';
import type { ResponseOf } from '@fancy/client';
import { Primary } from '../../../ui/Button.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { AccountPage, accountText } from '../../../ui/AccountPage.tsx';
import { useServices, useSessionState } from '../../../services.tsx';
import { useQuery } from '../../../api/useQuery.ts';
import { Avatar } from '../../../ui/Avatar.tsx';
import { colors } from '../../../ui/tokens.ts';
import { createStyles } from '../../../ui/styles.ts';
import { buildPatch, formFromMe, validateProfile, type ProfileField, type ProfileForm } from '../model.ts';
import { ProfileSaver } from '../save.ts';
import { ProfileFormView } from './ProfileFormView.tsx';

type PublicData = ResponseOf<'getPublicProfile'>['data'];

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
  // CONTRACT GAP: Me has no avatarUrl (and there is no avatar upload); the own public projection
  // supplies the current photo. Same cache key as MyProfileScreen, so it is usually instant.
  const pub = useQuery<PublicData>(me?.displayName ? `ownProfile:${me.id}:${me.version}` : null, async () => (await services.api.call('getPublicProfile', { params: { userId: me!.id } })).data);
  if (!me || !form) return <AccountPage><Text style={accountText.prose}>Please sign in to edit your profile.</Text></AccountPage>;

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
    <AccountPage testID="profile-edit" footer={<><FormMessage message={error?.message ?? null} /><Primary label="Save profile" icon="Check" busy={busy} onPress={() => void save()} /></>}>
      <View style={styles.photo} testID="profile-photo">
        <Avatar person={{ displayName: form.displayName || me.displayName || '?', avatarUrl: pub.data?.profile.id === me.id ? pub.data.profile.avatarUrl : null }} size={56} />
        <Text style={styles.photoNote}>Photo changes aren’t available in this version.</Text>
      </View>
      <Text accessibilityRole="header" style={accountText.h1}>Let people meet you.</Text>
      <Text style={[accountText.prose, { marginBottom: 14 }]}>A little background makes the first hello easier.</Text>
      <ProfileFormView form={form} onChange={setForm} error={error} mode="edit" />
    </AccountPage>
  );
}

const styles = createStyles({
  photo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  photoNote: { flex: 1, fontSize: 11, lineHeight: 16, color: colors.muted },
});
