import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Icon } from './Icon.tsx';
import { createStyles } from './styles.ts';
import { colors } from './tokens.ts';

/** Small demo primitives shared across screens (.pill, .tags span, .notice). */
export const Pill = ({ children }: { children: string }) => (
  <View style={styles.pill}><Text style={styles.pillText}>{children}</Text></View>
);

export const Tag = ({ children }: { children: string }) => (
  <View style={styles.tag}><Text style={styles.tagText}>{children}</Text></View>
);

export function Notice({ children, icon = false }: { children: ReactNode; icon?: boolean }) {
  return (
    <View style={styles.notice} accessibilityRole="text">
      {icon ? <Icon name="InfoCircled" size={16} color="#607160" /> : null}
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

const styles = createStyles({
  pill: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f0f3ec', borderRadius: 7 },
  pillText: { fontSize: 10, lineHeight: 14, color: '#536c5b' },
  tag: { borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 11 },
  tagText: { fontSize: 12, color: colors.ink },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#f2f5ee', marginVertical: 18 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 17, color: '#607160' },
});
