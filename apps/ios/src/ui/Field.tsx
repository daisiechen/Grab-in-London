import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, sizes, type } from './tokens.ts';
import { createStyles } from './styles.ts';

type Props = Omit<TextInputProps, 'style'> & { label: string; hint?: string; error?: string | null; multiline?: boolean };

/** Labelled native text input; the system keyboard and autofill own geometry. */
export function Field({ label, hint, error, multiline = false, ...input }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, error ? styles.invalid : null]}
        {...input}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

const styles = createStyles({
  wrap: { gap: 6 },
  label: { fontSize: type.control, fontWeight: '700', color: colors.ink },
  input: { minHeight: sizes.field, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: type.body, color: colors.ink, backgroundColor: colors.white },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  invalid: { borderColor: colors.danger },
  hint: { fontSize: type.meta, color: colors.muted },
  error: { fontSize: type.meta, color: colors.danger },
});
