import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthGate } from '../features/auth/useAuthGate.ts';
import { colors, sizes } from './tokens.ts';

export const TabGlyph = ({ glyph, color }: { glyph: string; color: ColorValue }) => <Text style={{ color, fontSize: 18 }} accessibilityElementsHidden>{glyph}</Text>;

/** Raised Create meal circle; guests are routed to sign-in with /create remembered (no auto-create). */
export function CreateTabButton() {
  const router = useRouter();
  const gate = useAuthGate();
  return (
    <View style={styles.slot}>
      <Pressable accessibilityRole="button" accessibilityLabel="Create meal" onPress={() => gate('/create') && router.push('/create')} style={styles.circle}>
        <Text style={styles.plus}>+</Text>
      </Pressable>
      <Text style={styles.label}>Create</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  circle: { width: sizes.createCircle, height: sizes.createCircle, borderRadius: sizes.createCircle / 2, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginTop: -18, shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  plus: { color: colors.white, fontSize: 28, lineHeight: 30, fontWeight: '600' },
  label: { fontSize: 10, color: colors.muted, marginTop: 2 },
});
