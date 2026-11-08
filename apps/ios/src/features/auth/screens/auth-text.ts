import { createStyles } from '../../../ui/styles.ts';
import { colors } from '../../../ui/tokens.ts';

/** Brand-entrance form stages (demo .brand-content): eyebrow, large title, prose — at the app's density. */
export const authText = createStyles({
  eyebrow: { fontSize: 9, letterSpacing: 1.6, color: '#526152', fontWeight: '700', marginBottom: 6 },
  h1: { fontSize: 30, lineHeight: 34, letterSpacing: -1.2, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  prose: { fontSize: 14, lineHeight: 21, color: '#55625a', marginBottom: 16 },
});
