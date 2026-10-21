import { Pressable, StyleSheet, Text, View } from 'react-native';
import { areaLabel, budgetLabel, seatsLabel, venueName, whenLabel, type Meal } from '../features/meals/format.ts';
import { colors, radius, type } from './tokens.ts';

/** Whole-card action; no nested interactive content (UX contract). */
export function MealCard({ meal, onPress, status }: { meal: Meal; onPress: () => void; status?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${meal.title}, ${whenLabel(meal.startsAt)}, ${seatsLabel(meal)}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.eyebrow}>{`${areaLabel(meal.areaCode).toUpperCase()} · ${meal.capacity === 2 ? 'A TABLE FOR TWO' : 'A SMALL TABLE'}`}</Text>
      <Text style={styles.title}>{meal.title}</Text>
      <Text style={styles.meta}>{whenLabel(meal.startsAt)}</Text>
      <Text style={styles.meta}>{`${venueName(meal)} · ${budgetLabel(meal)} per person`}</Text>
      <View style={styles.row}>
        <Text style={styles.meta}>{seatsLabel(meal)}</Text>
        <Text style={styles.meta}>{`Host · ${meal.host.displayName}`}</Text>
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      {meal.status === 'CANCELLED' ? <Text style={styles.cancelled}>Cancelled</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 14, gap: 4, backgroundColor: colors.white },
  pressed: { backgroundColor: colors.surface },
  eyebrow: { fontSize: type.caption, letterSpacing: 1, fontWeight: '700', color: colors.forest },
  title: { fontSize: type.section, fontWeight: '700', color: colors.ink },
  meta: { fontSize: type.meta, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { fontSize: type.control, color: colors.forest, fontWeight: '700' },
  cancelled: { fontSize: type.control, color: colors.danger, fontWeight: '700' },
});
