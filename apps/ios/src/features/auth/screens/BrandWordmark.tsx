import { Text, View } from 'react-native';
import { BRAND_COPY } from '../../../ui/brand.ts';
import { Icon } from '../../../ui/Icon.tsx';
import { createStyles } from '../../../ui/styles.ts';
import { colors } from '../../../ui/tokens.ts';

/** Demo .brand-wordmark: heavy lettering with the citrus arrow tucked at the top right. */
export function BrandWordmark({ size = 44 }: { size?: number }) {
  return (
    <View accessible accessibilityLabel={BRAND_COPY.name} style={styles.wrap}>
      <Text style={[styles.word, { fontSize: size, lineHeight: size * 1.1, letterSpacing: -size * 0.07 }]}>{BRAND_COPY.name}</Text>
      <View style={[styles.arrow, { right: -size * 0.42, top: size * 0.02 }]}>
        <Icon name="ArrowTopRight" size={Math.round(size * 0.4)} color="#e96943" />
      </View>
    </View>
  );
}

const styles = createStyles({
  wrap: { alignSelf: 'flex-start', marginRight: 20 },
  word: { fontSize: 44, fontWeight: '900', color: colors.forest },
  arrow: { position: 'absolute' },
});
