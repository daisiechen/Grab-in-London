import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon.tsx';
import { colors } from './tokens.ts';
import { createStyles } from './styles.ts';

/** Native stack header content height on iPhone (the status bar inset sits above it). */
const IOS_HEADER = 44;

/**
 * Page shell for the account area (post-meal, settings, survey, report, deletion): content starts right
 * under the native header (or the safe area for a top-level tab), the primary action is pinned in a
 * bottom bar, and fields stay above the keyboard (docs/engineering/ios-ui-conventions.zh-CN.md §1).
 */
export function AccountPage({ children, footer, testID, top = 'header' }: { children: ReactNode; footer?: ReactNode; testID?: string; top?: 'header' | 'safe' }) {
  const insets = useSafeAreaInsets();
  const paddingTop = top === 'header' ? 12 : insets.top + 4;
  return (
    <View style={styles.page} testID={testID}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={top === 'header' ? insets.top + IOS_HEADER : 0}>
        <ScrollView style={styles.flex} contentContainerStyle={[styles.scroll, { paddingTop }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {children}
        </ScrollView>
        {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Settings list row (demo .settings-link): whole row is the button, chevron on the right. */
export function SettingsLink({ label, onPress, danger = false, disabled = false }: { label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={[styles.rowLabel, danger && styles.danger]}>{label}</Text>
      <Icon name="ChevronRight" size={16} color={danger ? colors.danger : colors.muted} />
    </Pressable>
  );
}

/** Read-only label/value row (demo .settings-info-row). */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/** Pale bordered box for receipts and saved states (demo .summary-box). */
export function SummaryBox({ children, testID }: { children: ReactNode; testID?: string }) {
  return <View style={styles.summary} testID={testID}>{children}</View>;
}

/** Text styles shared by the account pages, at the density of the owner's device reviews. */
export const accountText = createStyles({
  h1: { fontSize: 24, lineHeight: 28, letterSpacing: -0.8, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  prose: { fontSize: 14, lineHeight: 21, color: '#55625a' },
  h2: { fontSize: 16, letterSpacing: -0.3, fontWeight: '700', color: colors.ink, marginTop: 18, marginBottom: 8 },
  body: { fontSize: 13, lineHeight: 19, color: '#55625a', marginBottom: 6 },
  muted: { fontSize: 11, lineHeight: 16, color: colors.muted },
  strong: { fontSize: 15, fontWeight: '700', color: colors.ink },
  code: { fontSize: 13, lineHeight: 18, color: colors.ink, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 6 },
});

const styles = createStyles({
  page: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingBottom: 24 },
  footer: { paddingTop: 10, paddingHorizontal: 18, gap: 4, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15, minHeight: 48, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.5 },
  rowLabel: { flex: 1, fontSize: 14, color: colors.ink },
  danger: { color: colors.danger },
  infoLabel: { fontSize: 13, color: colors.ink },
  infoValue: { fontSize: 13, fontWeight: '700', color: colors.ink, flexShrink: 1, textAlign: 'right' },
  summary: { padding: 14, backgroundColor: '#f6f7f3', borderWidth: 1, borderColor: colors.line, borderRadius: 12, marginVertical: 12, gap: 4 },
});
