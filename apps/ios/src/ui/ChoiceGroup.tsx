import { Pressable, Text, View } from 'react-native';
import { colors, radius } from './tokens.ts';
import { createStyles } from './styles.ts';

type Option<V extends string> = readonly [value: V, label: string];

/** Outlined chips; selected = pale-green surface + check + accessibility state (DESIGN.md). */
export function ChoiceGroup<V extends string>({ label, options, value, onChange }: { label: string; options: readonly Option<V>[]; value: V | null; onChange: (value: V) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      <Text style={styles.legend}>{label}</Text>
      <View style={styles.grid}>
        {options.map(([v, text]) => (
          <Chip key={v} label={text} selected={value === v} role="radio" onPress={() => onChange(v)} />
        ))}
      </View>
    </View>
  );
}

export function MultiChoice<V extends string>({ label, options, values, onToggle }: { label: string; options: readonly Option<V>[]; values: readonly V[]; onToggle: (value: V) => void }) {
  return (
    <View accessibilityLabel={label} style={styles.group}>
      <Text style={styles.legend}>{label}</Text>
      <View style={styles.grid}>
        {options.map(([v, text]) => (
          <Chip key={v} label={text} selected={values.includes(v)} role="checkbox" onPress={() => onToggle(v)} />
        ))}
      </View>
    </View>
  );
}

function Chip({ label, selected, role, onPress }: { label: string; selected: boolean; role: 'radio' | 'checkbox'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.chipLabel, selected && styles.selectedLabel]}>{selected ? `✓ ${label}` : label}</Text>
    </Pressable>
  );
}

const styles = createStyles({
  group: { gap: 6 },
  legend: { fontSize: 12, fontWeight: '700', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 32, paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, justifyContent: 'center' },
  selected: { backgroundColor: colors.selectedSurface, borderColor: colors.forest },
  chipLabel: { fontSize: 12, color: colors.ink },
  selectedLabel: { color: colors.forest, fontWeight: '700' },
});
