import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { addMonths, longDate, monthGrid, monthTitle } from '../lib/london.ts';
import { colors, type } from './tokens.ts';
import { createStyles } from './styles.ts';

/** Month/day chooser (prototype DateChoices) on London calendar dates; past dates are disabled. */
export function DateChoices({ label, selected, onToggle, today, multiple = false }: { label: string; selected: readonly string[]; onToggle: (date: string) => void; today: string; multiple?: boolean }) {
  const [month, setMonth] = useState((selected[0] ?? today).slice(0, 7));
  const { leading, dates } = monthGrid(month);
  const canGoBack = month > today.slice(0, 7);
  return (
    <View style={styles.wrap} accessibilityLabel={label}>
      <Text style={styles.legend}>{label}</Text>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" accessibilityState={{ disabled: !canGoBack }} disabled={!canGoBack} onPress={() => setMonth(addMonths(month, -1))} hitSlop={8}>
          <Text style={[styles.nav, !canGoBack && styles.disabled]}>‹</Text>
        </Pressable>
        <Text style={styles.month}>{monthTitle(month)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setMonth(addMonths(month, 1))} hitSlop={8}>
          <Text style={styles.nav}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {Array.from({ length: leading }, (_, i) => <View key={`b${i}`} style={styles.cell} />)}
        {dates.map((d) => {
          const past = d < today;
          const on = selected.includes(d);
          return (
            <View key={d} style={styles.cell}>
              <Pressable
                accessibilityRole={multiple ? 'checkbox' : 'radio'}
                accessibilityLabel={longDate(d)}
                accessibilityState={multiple ? { checked: on, disabled: past } : { selected: on, disabled: past }}
                disabled={past}
                onPress={() => onToggle(d)}
                style={[styles.day, on && styles.on]}
              >
                <Text style={[styles.dayText, past && styles.disabled, on && styles.onText]}>{Number(d.slice(8))}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = createStyles({
  wrap: { gap: 8 },
  legend: { fontSize: type.control, fontWeight: '700', color: colors.ink },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nav: { fontSize: 24, color: colors.forest, paddingHorizontal: 8 },
  month: { fontSize: type.body, fontWeight: '700', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // Each cell centres a fixed 36pt circle, so the selected background always sits around the number.
  cell: { width: `${100 / 7}%`, height: 40, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.forest },
  dayText: { fontSize: type.body, lineHeight: 18, color: colors.ink, textAlign: 'center' },
  onText: { color: colors.white, fontWeight: '700' },
  disabled: { color: colors.line },
});
