import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, type } from './tokens.ts';

export const Heading = ({ children }: { children: ReactNode }) => <Text accessibilityRole="header" style={styles.heading}>{children}</Text>;
export const SectionTitle = ({ children }: { children: ReactNode }) => <Text accessibilityRole="header" style={styles.section}>{children}</Text>;
export const Eyebrow = ({ children }: { children: ReactNode }) => <Text style={styles.eyebrow}>{children}</Text>;
export const Body = ({ children, muted = false }: { children: ReactNode; muted?: boolean }) => <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;

const styles = StyleSheet.create({
  heading: { fontSize: type.heading, fontWeight: '700', color: colors.ink },
  section: { fontSize: type.section, fontWeight: '700', color: colors.ink },
  eyebrow: { fontSize: type.caption, fontWeight: '700', letterSpacing: 1, color: colors.forest },
  body: { fontSize: type.body, lineHeight: 20, color: colors.ink },
  muted: { color: colors.muted },
});
