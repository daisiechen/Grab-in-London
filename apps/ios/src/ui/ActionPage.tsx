import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingBack } from './FloatingBack.tsx';
import { colors } from './tokens.ts';
import { createStyles } from './styles.ts';

/** Warm paper of the demo's brand entrance (.brand-entrance). */
export const BRAND_PAPER = '#f5f2e8';

/** Native stack header content height on iPhone (the status bar inset sits above it). */
const IOS_HEADER = 44;

type Top =
  /** Under the system navigation bar (form pages keep the native back button). */
  | 'header'
  /** Header-less detail page with the floating back disc. */
  | 'floating'
  /** Header-less page without a back control (e.g. the sign-in modal). */
  | 'safe';

/**
 * Page with content right under the top edge and the primary action pinned in a bottom bar
 * (docs/engineering/ios-ui-conventions.zh-CN.md §1). Fields stay above the keyboard.
 */
export function ActionPage({ children, footer, overlay, testID, top = 'header', paper = false }: { children: ReactNode; footer?: ReactNode; /** Sheets/modals, rendered after the footer. */ overlay?: ReactNode; testID?: string; top?: Top; paper?: boolean }) {
  const insets = useSafeAreaInsets();
  const background = paper ? BRAND_PAPER : colors.white;
  const paddingTop = top === 'header' ? 12 : top === 'floating' ? insets.top + 4 : insets.top + 8;
  return (
    <View style={[styles.page, { backgroundColor: background }]} testID={testID}>
      {top === 'floating' ? <FloatingBack /> : null}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={top === 'header' ? insets.top + IOS_HEADER : 0}>
        <ScrollView style={styles.flex} contentContainerStyle={[styles.scroll, { paddingTop }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {children}
        </ScrollView>
        {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: background }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
      {overlay}
    </View>
  );
}

const styles = createStyles({
  page: { flex: 1 },
  flex: { flex: 1 },
  // flexGrow lets a child (e.g. the sign-in artwork) take spare height instead of leaving a blank band.
  scroll: { flexGrow: 1, paddingHorizontal: 18, paddingBottom: 24 },
  footer: { paddingTop: 10, paddingHorizontal: 18, gap: 4, borderTopWidth: 1, borderTopColor: colors.line },
});

/** Shared text styles for J01 pages: eyebrow, page title, prose (demo .eyebrow / h1 / .prose at the app's density). */
export const pageText = createStyles({
  eyebrow: { fontSize: 9, letterSpacing: 1.3, color: '#647a6b', fontWeight: '700', marginBottom: 6 },
  h1: { fontSize: 24, lineHeight: 28, letterSpacing: -0.8, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  prose: { fontSize: 14, lineHeight: 21, color: '#55625a' },
  h2: { fontSize: 16, letterSpacing: -0.3, fontWeight: '700', color: colors.ink, marginTop: 18, marginBottom: 8 },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted },
});
