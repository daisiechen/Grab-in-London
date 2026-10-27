import { ActivityIndicator, Pressable, Text } from 'react-native';
import { colors, radius, sizes } from './tokens.ts';
import { Icon, type IconName } from './Icon.tsx';
import { createStyles } from './styles.ts';

type Props = { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean; testID?: string; icon?: IconName };

/** Primary/secondary share sizing (DESIGN.md); disabled and processing states are exposed to VoiceOver. */
export function Primary({ label, onPress, busy = false, disabled = false, secondary = false, testID, icon }: Props) {
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.base, secondary ? styles.secondary : styles.primary, pressed && styles.pressed, inactive && styles.inactive]}
    >
      {busy ? <ActivityIndicator color={secondary ? colors.forest : colors.white} /> : null}
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
      {icon && !busy ? <Icon name={icon} size={17} color={secondary ? colors.forest : colors.white} /> : null}
    </Pressable>
  );
}

export function TextAction({ label, onPress, destructive = false, disabled = false }: { label: string; onPress: () => void; destructive?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={styles.text} hitSlop={8}>
      <Text style={[styles.textLabel, destructive && styles.destructive, disabled && styles.disabledText]}>{label}</Text>
    </Pressable>
  );
}

const styles = createStyles({
  base: { minHeight: sizes.button, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1 },
  primary: { backgroundColor: colors.forest, borderColor: colors.forest },
  secondary: { backgroundColor: 'transparent', borderColor: colors.secondaryBorder },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.5 },
  label: { color: colors.white, fontSize: 13, lineHeight: 16, fontWeight: '600' },
  secondaryLabel: { color: colors.forest },
  text: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  textLabel: { color: colors.forest, fontSize: 12, textDecorationLine: 'underline' },
  destructive: { color: colors.danger },
  disabledText: { color: colors.muted },
});
