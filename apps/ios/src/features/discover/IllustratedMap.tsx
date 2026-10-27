import { Image, Pressable, Text, View } from 'react-native';
import { images } from '../../ui/images.ts';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import type { AreaGroup } from './areas.ts';

export interface AreaMapProps { groups: AreaGroup[]; activeCode: string | null; onSelect: (code: string) => void }

/** Demo map: the illustrated central-London artwork with one count pin per area. */
export function IllustratedMap({ groups, activeCode, onSelect }: AreaMapProps) {
  return (
    <View style={styles.fill}>
      <Image source={images.londonMap} style={styles.fill} resizeMode="cover" accessibilityLabel="Map of central London" />
      {groups.map((g) => <AreaPin key={g.code} group={g} active={g.code === activeCode} onPress={() => onSelect(g.code)} style={{ position: 'absolute', left: `${g.x}%`, top: `${g.y}%`, marginLeft: g.code === activeCode ? -19.5 : -17, marginTop: g.code === activeCode ? -22.5 : -20 }} />)}
    </View>
  );
}

/** Forest count pin (peach and larger when selected), shared by the illustrated and Google maps. */
export function AreaPin({ group, active, onPress, style }: { group: AreaGroup; active: boolean; onPress?: () => void; style?: object }) {
  const label = `${group.name}: ${group.meals.length} ${group.meals.length === 1 ? 'meal' : 'meals'}`;
  const body = <Text style={[styles.pinText, active && styles.pinTextActive]}>{group.meals.length}</Text>;
  if (!onPress) return <View accessibilityLabel={label} style={[styles.pin, active && styles.pinActive, style]}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.pin, active && styles.pinActive, style]}>
      {body}
    </Pressable>
  );
}

const styles = createStyles({
  fill: { width: '100%', height: '100%' },
  pin: { width: 34, height: 40, borderTopLeftRadius: 17, borderTopRightRadius: 17, borderBottomRightRadius: 17, borderBottomLeftRadius: 8, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', shadowColor: colors.forest, shadowOpacity: 0.13, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, zIndex: 1 },
  pinActive: { width: 39, height: 45, borderTopLeftRadius: 19.5, borderTopRightRadius: 19.5, borderBottomRightRadius: 19.5, backgroundColor: colors.peach, zIndex: 2 },
  pinText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  pinTextActive: { color: colors.ink },
});
