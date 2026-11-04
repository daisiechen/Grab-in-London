import { Image, Pressable, Text, View } from 'react-native';
import { avatarSource } from './images.ts';
import { colors } from './tokens.ts';
import { createStyles } from './styles.ts';

type Person = { displayName: string; avatarUrl: string | null };

/** Circular portrait (demo .avatar); initials on the pale surface when there is no photo. */
export function Avatar({ person, size = 32, onPress }: { person: Person; size?: number; onPress?: () => void }) {
  const source = avatarSource(person.avatarUrl);
  const body = (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      {source ? (
        <Image source={source} style={styles.image} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.4) }]}>{person.displayName.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
  if (!onPress) return <View accessible accessibilityLabel={person.displayName}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${person.displayName}’s profile`} onPress={onPress} hitSlop={4}>
      {body}
    </Pressable>
  );
}

const styles = createStyles({
  circle: { overflow: 'hidden', backgroundColor: '#ecefe7', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  initial: { color: colors.forest, fontWeight: '700' },
});
