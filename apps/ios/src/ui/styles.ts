import { StyleSheet } from 'react-native';

/** demo/DESIGN.md typography: Arial/Helvetica, available natively on iOS and in the web preview. */
export const FONT_FAMILY = 'Arial';

type Styles = Parameters<typeof StyleSheet.create>[0];

/** StyleSheet.create that gives every text style (anything with a fontSize) the app font. */
export function createStyles<S extends Styles>(styles: S & Styles): Readonly<S> {
  const withFont = Object.fromEntries(
    Object.entries(styles).map(([key, style]) => [key, style && typeof style === 'object' && 'fontSize' in style && !('fontFamily' in style) ? { fontFamily: FONT_FAMILY, ...style } : style]),
  ) as S & Styles;
  return StyleSheet.create(withFont);
}
