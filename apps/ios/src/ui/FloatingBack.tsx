import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon.tsx';
import { colors } from './tokens.ts';
import { createStyles } from './styles.ts';

export const FLOATING_BACK_SIZE = 36;

/**
 * Back control for header-less pages: a 36pt disc floating at the top-left safe-area corner, so
 * content can start right under the status bar. The swipe-back gesture still works.
 */
export function FloatingBack() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} style={[styles.disc, { top: insets.top + 4 }]}>
      <Icon name="ArrowLeft" size={18} color={colors.ink} />
    </Pressable>
  );
}

const styles = createStyles({
  disc: { position: 'absolute', left: 12, zIndex: 30, width: FLOATING_BACK_SIZE, height: FLOATING_BACK_SIZE, borderRadius: FLOATING_BACK_SIZE / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffffee', borderWidth: 1, borderColor: colors.line, shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
});
