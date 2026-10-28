import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { BRAND_COPY } from '../../../ui/brand.ts';
import { ActionPage } from '../../../ui/ActionPage.tsx';
import { Primary, TextAction } from '../../../ui/Button.tsx';
import { FormMessage } from '../../../ui/FormMessage.tsx';
import { Icon } from '../../../ui/Icon.tsx';
import { images } from '../../../ui/images.ts';
import { Sheet } from '../../../ui/Sheet.tsx';
import { createStyles } from '../../../ui/styles.ts';
import { colors } from '../../../ui/tokens.ts';
import { Body } from '../../../ui/Text.tsx';
import { useServices } from '../../../services.tsx';
import { AUTH_REDIRECT_URL } from '../../../config.ts';
import { signInWithProvider, type Provider } from '../oauth.ts';
import { useFinishSignIn } from '../useAuthGate.ts';
import { clearPendingLink, getPendingLink, setPendingLink } from '../link.ts';
import { BrandWordmark } from './BrandWordmark.tsx';

/**
 * The prototype BrandEntrance welcome with the account choices on the same first screen:
 * wordmark, table artwork, invitation, then email / Google / Apple (real system-browser providers).
 */
export function SignInScreen() {
  const services = useServices();
  const router = useRouter();
  const finish = useFinishSignIn();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const linking = getPendingLink(services.now()) !== null;

  const provider = async (p: Provider) => {
    const generation=services.session.generation;
    setBusy(p);
    setIssue(null);
    const result = await signInWithProvider(p, { ...services, redirectUrl: AUTH_REDIRECT_URL });
    setBusy(null);
    if(generation!==services.session.generation)return;
    if (result.kind === 'signedIn') finish(result.session,result.authProof);
    else if (result.kind === 'linkRequired') {
      if(getPendingLink(services.now())){
        clearPendingLink();
        setIssue("Use the sign-in method already linked to your original account. Start again.");
        return;
      }
      setPendingLink({linkTicket:result.linkTicket,appVerifier:result.appVerifier,expiresAt:result.expiresAt},services.now(),services.newId());
      router.push('/link-required');
    } else if(result.kind==='cancelled')clearPendingLink();
    else if (result.kind === 'failed') setIssue(result.message);
  };
  const browse = () => {clearPendingLink();if(router.canGoBack())router.back();else router.replace('/');};

  return (
    <ActionPage testID="sign-in" top="safe" paper overlay={(
      <Sheet visible={showTerms} title="Community & privacy principles" onClose={() => setShowTerms(false)}>
        <Body>Adults 18+ meet for friendship over meals. Respect boundaries and dietary needs. No harassment or unsolicited pitches.</Body>
        <Body>Your name, photo and introduction are public to other members; your email is private.</Body>
      </Sheet>
    )}>
      <View style={styles.header}>
        <BrandWordmark />
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={browse} style={styles.close}>
          <Icon name="Cross2" size={16} color={colors.forest} />
        </Pressable>
      </View>
      <View style={styles.art}>
        <Image source={images.brandTable} style={styles.artImage} resizeMode="cover" accessibilityLabel="A sculptural green table with colourful chairs, laid for new friends" />
      </View>
      <Text style={styles.eyebrow}>{BRAND_COPY.welcomeSupport.toUpperCase()}</Text>
      <Text accessibilityRole="header" style={styles.h1}>{BRAND_COPY.invitation}</Text>
      <Text style={styles.lede}>{linking ? 'Sign in using the method already linked to your original account, then confirm the link.' : `${BRAND_COPY.slogan} Join a table, or come back for another.`}</Text>

      <Primary label="Continue with email" icon="ArrowRight" onPress={() => router.push('/email')} disabled={busy !== null} />
      <View style={styles.divider}><View style={styles.rule} /><Text style={styles.or}>or</Text><View style={styles.rule} /></View>
      <ProviderButton label="Continue with Google" busy={busy === 'GOOGLE'} disabled={busy !== null} onPress={() => void provider('GOOGLE')} />
      <ProviderButton label="Continue with Apple" busy={busy === 'APPLE'} disabled={busy !== null} onPress={() => void provider('APPLE')} />
      <FormMessage message={issue} />
      <View style={styles.links}>
        <TextAction label="Privacy & community principles" onPress={() => setShowTerms(true)} />
        <TextAction label="Keep exploring without an account" onPress={browse} />
      </View>
    </ActionPage>
  );
}

/** Outlined provider row (demo .brand-provider): label left, external-link glyph right. */
function ProviderButton({ label, busy, disabled, onPress }: { label: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.provider, pressed && styles.pressed, disabled && !busy && styles.inactive]}
    >
      <Text style={styles.providerLabel}>{label}</Text>
      {busy ? <ActivityIndicator color={colors.forest} /> : <Icon name="ExternalLink" size={15} color={colors.forest} />}
    </Pressable>
  );
}

const styles = createStyles({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#d8dbce', alignItems: 'center', justifyContent: 'center' },
  // Fixed frame; the artwork's own paper matches the page, so the crop has no visible edge.
  // The artwork absorbs spare height (190–380pt), so tall screens have no empty band under the links.
  art: { flexGrow: 1, flexShrink: 1, minHeight: 190, maxHeight: 380, marginHorizontal: -18, marginTop: 4, overflow: 'hidden' },
  artImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  eyebrow: { fontSize: 9, letterSpacing: 2, color: '#526152', fontWeight: '700', marginTop: 10 },
  h1: { fontSize: 36, lineHeight: 38, letterSpacing: -1.6, fontWeight: '700', color: colors.ink, marginTop: 6 },
  lede: { fontSize: 14, lineHeight: 20, color: '#55625a', marginTop: 6, marginBottom: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 },
  rule: { flex: 1, height: 1, backgroundColor: '#d8dbce' },
  or: { fontSize: 12, color: colors.muted },
  provider: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderWidth: 1, borderColor: '#bdc7bb', borderRadius: 11, backgroundColor: '#fffdf7', marginBottom: 8 },
  providerLabel: { fontSize: 14, color: colors.forest },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.5 },
  links: { marginTop: 4, alignItems: 'center' },
});
