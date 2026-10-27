import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon.tsx';
import { colors } from './tokens.ts';

/** Demo page-header back control: arrow-left in a 44pt target. */
export function HeaderBack() {
  const router = useRouter();
  if (!router.canGoBack()) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 }}>
      <Icon name="ArrowLeft" size={18} color={colors.ink} />
    </Pressable>
  );
}
