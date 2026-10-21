import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Screen } from '../../ui/Screen.tsx';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body, SectionTitle } from '../../ui/Text.tsx';
import { useServices, useSessionState } from '../../services.tsx';

/** Settings (own profile only). Privacy copy, sign-out, account deletion, deletion status and the product survey. */
export function SettingsScreen() {
  const { session } = useServices();
  const state = useSessionState();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const signOut = async () => {
    setBusy(true);
    const { serverRevoked } = await session.logout();
    setBusy(false);
    setConfirm(false);
    if (!serverRevoked) setNote('Signed out on this iPhone. We couldn’t reach Fancy to end the session remotely; it will expire on its own.');
    router.replace('/');
  };

  return (
    <Screen testID="settings">
      <SectionTitle>Privacy & safety</SectionTitle>
      <Body>Your name, photo and introduction help your table get to know you. Your email is private.</Body>
      <Body>Meal groups require a confirmed seat. Private conversations require mutual choice after a shared meal.</Body>
      <SectionTitle>App language</SectionTitle>
      <Body>English</Body>
      <Body muted>Conversation languages can be changed in your profile.</Body>
      <SectionTitle>Account</SectionTitle>
      {state.status === 'signedIn' ? <TextAction label="Edit public profile" onPress={() => router.push('/profile-edit')} /> : null}
      {state.status === 'signedIn' ? <TextAction destructive label="Sign out" onPress={() => setConfirm(true)} /> : null}
      {state.status === 'signedIn' ? <TextAction destructive label="Delete account" onPress={() => router.push('/delete-account')} /> : null}
      <TextAction label="Check deletion status" onPress={() => router.push('/deletion-status')} />
      <SectionTitle>Help shape Fancy</SectionTitle>
      {state.status === 'signedIn' ? <TextAction label="Product survey" onPress={() => router.push('/survey')} /> : null}
      <FormMessage message={note} tone="info" />
      <Sheet visible={confirm} title="Sign out?" onClose={() => setConfirm(false)}>
        <Body>You’ll return to the account screen.</Body>
        <Primary secondary label="Stay signed in" onPress={() => setConfirm(false)} />
        <TextAction destructive label="Sign out" disabled={busy} onPress={() => void signOut()} />
      </Sheet>
    </Screen>
  );
}
