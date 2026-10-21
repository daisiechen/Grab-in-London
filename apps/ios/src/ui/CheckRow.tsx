import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, type } from './tokens.ts';

/** Explicit opt-in checkbox; never defaults to checked. */
export function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={styles.row}>
      <View style={[styles.box, checked && styles.checked]}>{checked ? <Text style={styles.tick}>✓</Text> : null}</View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6 },
  box: { width: 22, height: 22, borderRadius: radius.sm - 2, borderWidth: 1, borderColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.forest },
  tick: { color: colors.white, fontWeight: '700' },
  label: { flex: 1, fontSize: type.control, lineHeight: 18, color: colors.ink },
});
