import { StyleSheet, Text } from 'react-native';
import { colors, type } from './tokens.ts';

/** Single status/alert line (prototype `form-error` role=alert / notify role=status). */
export function FormMessage({ message, tone = 'error' }: { message: string | null; tone?: 'error' | 'info' }) {
  if (!message) return null;
  return (
    <Text accessibilityRole={tone === 'error' ? 'alert' : 'text'} accessibilityLiveRegion="polite" style={[styles.base, tone === 'error' ? styles.error : styles.info]}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { fontSize: type.control, lineHeight: 18 },
  error: { color: colors.danger },
  info: { color: colors.forest },
});
