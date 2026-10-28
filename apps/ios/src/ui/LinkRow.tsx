import { Pressable, Text, View } from 'react-native';
import { Icon, type IconName } from './Icon.tsx';
import { createStyles } from './styles.ts';
import { colors } from './tokens.ts';

/**
 * A row that clearly navigates somewhere (owner review: bare text links didn't read as tappable):
 * icon in a soft circle, label, chevron. Use for secondary destinations such as terms or reporting.
 */
export function LinkRow({ icon, label, onPress, first = false }: { icon: IconName; label: string; onPress: () => void; first?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.row, first && styles.first, pressed && styles.pressed]}>
      <View style={styles.icon}><Icon name={icon} size={14} color={colors.forest} /></View>
      <Text style={styles.label}>{label}</Text>
      <Icon name="ChevronRight" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = createStyles({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line },
  first: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { opacity: 0.6 },
  icon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
});
