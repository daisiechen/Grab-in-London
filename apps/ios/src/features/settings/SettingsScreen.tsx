import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { AccountPage, SettingsLink, accountText } from '../../ui/AccountPage.tsx';
import { colors } from '../../ui/tokens.ts';
import { createStyles } from '../../ui/styles.ts';
import { Sheet } from '../../ui/Sheet.tsx';
import { Body } from '../../ui/Text.tsx';
import { useServices, useSessionState } from '../../services.tsx';
import { AnalyticsConsent } from '../../analytics/Consent.tsx';
import { LEGAL_PAGES, openLegalPage, type LegalPage } from '../../lib/legal.ts';

/** Order of the public legal/support pages under “Help & legal” (App Store: privacy policy, terms, contact). */
const LEGAL_ROWS: readonly LegalPage[] = ['support', 'guidelines', 'terms', 'privacy'];

/**
 * Settings (own account only), grouped as in the demo: notifications & previews, privacy & safety,
 * help shape Fancy, account, then help & legal pages and data credits. Sign-out is confirmed in a sheet.
 */
export function SettingsScreen() {
  const { session, analytics } = useServices();
  const state = useSessionState();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const signedIn = state.status === 'signedIn';

  const signOut = async () => {
    setBusy(true);
    await session.logout();
    setBusy(false);
    setConfirm(false);
    if(session.getState().status==='signedOut')router.replace('/');
  };

  return (
    <AccountPage testID="settings">
      {signedIn ? (
        <>
          <Text accessibilityRole="header" style={[accountText.h2, { marginTop: 4 }]}>Notifications & previews</Text>
          <SettingsLink label="Notifications" onPress={() => router.push('/notifications')} />
          <Text style={[accountText.muted, { marginTop: 6 }]}>Meal updates and messages always stay in Inbox. Device banners aren’t part of this version.</Text>
        </>
      ) : null}

      <Text accessibilityRole="header" style={[accountText.h2, !signedIn && { marginTop: 4 }]}>Privacy & safety</Text>
      <Text style={accountText.body}>Your name, photo and introduction help your table get to know you. Your email is private.</Text>
      <Text style={accountText.body}>Meal groups require a confirmed seat. Private conversations require mutual choice after a shared meal.</Text>
      {signedIn ? <SettingsLink label="Blocked members" onPress={() => router.push('/blocked-members')} /> : null}
      <InfoLine label="App language" value="English" />
      <Text style={[accountText.muted, { marginTop: 6 }]}>Conversation languages can be changed in your profile.</Text>

      {signedIn ? (
        <>
          <Text accessibilityRole="header" style={accountText.h2}>Help shape Fancy</Text>
          <SettingsLink label="Product survey" onPress={() => router.push('/survey')} />
          <AnalyticsConsent manager={analytics} />
        </>
      ) : null}

      <Text accessibilityRole="header" style={accountText.h2}>Account</Text>
      {signedIn ? <SettingsLink label="Edit public profile" onPress={() => router.push('/profile-edit')} /> : null}
      <SettingsLink label="Check deletion status" onPress={() => router.push('/deletion-status')} />
      {signedIn ? <SettingsLink danger label="Delete account" onPress={() => router.push('/delete-account')} /> : null}
      {signedIn ? <SettingsLink danger label="Sign out" onPress={() => setConfirm(true)} /> : null}

      {/* Public pages hosted on the Fancy site; available to guests too (App Store privacy-policy and support links). */}
      <Text accessibilityRole="header" style={accountText.h2}>Help & legal</Text>
      {LEGAL_ROWS.map((page) => <SettingsLink key={page} label={LEGAL_PAGES[page].label} onPress={() => void openLegalPage(page)} />)}

      {/* Credits the area boundary and name sources as their licences require (docs/engineering/london-areas.zh-CN.md). */}
      <Text accessibilityRole="header" style={accountText.h2}>Data sources</Text>
      <Text style={accountText.muted}>London areas: Office for National Statistics, licensed under the Open Government Licence v3.0. Contains OS data © Crown copyright and database right 2021. Area names: House of Commons Library MSOA Names 2.3, licensed under the Open Parliament Licence v3.0.</Text>

      <Sheet visible={confirm} title="Sign out?" onClose={() => setConfirm(false)}>
        <Body>You’ll return to the account screen.</Body>
        <Primary secondary label="Stay signed in" onPress={() => setConfirm(false)} />
        <TextAction destructive label="Sign out" disabled={busy} onPress={() => void signOut()} />
      </Sheet>
    </AccountPage>
  );
}

/**
 * Information only (not a button): plain text, muted value, no divider and no chevron, so it can't
 * be mistaken for the tappable SettingsLink rows that carry a chevron.
 */
function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info} accessible accessibilityRole="text" accessibilityLabel={`${label}: ${value}`} testID="settings-info">
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = createStyles({
  info: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  infoLabel: { fontSize: 13, color: '#55625a' },
  infoValue: { fontSize: 13, color: colors.muted, flexShrink: 1, textAlign: 'right' },
});
