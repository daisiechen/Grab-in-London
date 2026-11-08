import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { createStyles } from './styles.ts';
import { colors } from './tokens.ts';

/**
 * The one page-title pattern (owner review 2026-10-28): big title on top, a short muted line under it,
 * an optional control on the title row (e.g. Discover's city chip, Inbox's bell). No eyebrow above the
 * title. `tab` is the top-level tab size; `page` is for pushed pages and forms.
 */
export function PageHeader({ title, subtitle, right, size = 'page' }: { title: string; subtitle?: string | undefined; right?: ReactNode; size?: 'tab' | 'page' }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text accessibilityRole="header" style={[styles.title, size === 'tab' ? styles.tab : styles.page]}>{title}</Text>
        {right}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = createStyles({
  wrap: { gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1, fontWeight: '700', color: colors.ink },
  tab: { fontSize: 27, lineHeight: 31, letterSpacing: -1.1 },
  page: { fontSize: 24, lineHeight: 28, letterSpacing: -0.8 },
  subtitle: { fontSize: 12, lineHeight: 17, color: colors.muted },
});
