import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SUPPORT_EMAIL, supportMailto } from '@fancy/client';
import { Primary } from '../../ui/Button.tsx';
import { Body, SectionTitle } from '../../ui/Text.tsx';
import { colors, type } from '../../ui/tokens.ts';

/**
 * Public support exit after a deletion request (Figma 489:*), no sign-in required. The address
 * is selectable for manual copy; the mail link carries no reference/token, and opening the mail
 * editor is never shown as sent.
 */
export function SupportExit({ reason }: { reason: 'needsSupport' | 'receiptUnavailable' }) {
  const [note, setNote] = useState('Opening your email app doesn’t send anything by itself.');
  const open = async () => {
    try { await Linking.openURL(supportMailto()); }
    catch { setNote('No email app is available. Select the address above to copy it.'); }
  };
  return (
    <View style={{ gap: 6 }} testID="support-exit">
      <SectionTitle>Contact support</SectionTitle>
      <Body>{reason === 'needsSupport'
        ? 'Our support team needs to finish removing your account. You don’t need to sign in to contact us.'
        : 'Your removal reference isn’t available. You can still contact support without signing in.'}</Body>
      <Text selectable accessibilityLabel={`Support email ${SUPPORT_EMAIL}`} style={styles.email}>{SUPPORT_EMAIL}</Text>
      <Body muted>Describe the issue in your own words. Don’t include passwords or your removal reference.</Body>
      <Primary secondary label="Email support" onPress={() => void open()} />
      <Body muted>{note}</Body>
    </View>
  );
}

const styles = StyleSheet.create({ email: { fontSize: type.body, fontWeight: '700', color: colors.ink } });
