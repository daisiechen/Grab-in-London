import { Pressable, Text, View } from 'react-native';
import { cardBudgetLabel, cardWhenLabel, languagesLabel, moodLabel, venueName, type Meal } from '../features/meals/format.ts';
import { Avatar } from './Avatar.tsx';
import { areaName } from '../features/discover/areas.ts';
import { Icon, type IconName } from './Icon.tsx';
import { RestaurantPhoto } from './RestaurantPhoto.tsx';
import { colors } from './tokens.ts';
import { createStyles } from './styles.ts';

type Person = Meal['host'];

/**
 * Demo meal card: photo column + copy, whole-card action with independent avatar buttons.
 * `compact` is the list/area-sheet variant (narrower photo, mood pill instead of caption).
 */
export function MealCard({ meal, onPress, onPerson, members, compact = false, status }: {
  meal: Meal;
  onPress: () => void;
  onPerson?: (person: Person) => void;
  /** People to show; the public Meal projection only carries the host. */
  members?: Person[];
  compact?: boolean;
  status?: string;
}) {
  const people = (members?.length ? members : [meal.host]).slice(0, 3);
  return (
    <RestaurantPhoto venueRef={meal.venue.venueRef} placeId={meal.venue.placeId} name={venueName(meal)} fill>
      {({ image, attribution }) => (
        <View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${meal.title}`}
            onPress={onPress}
            style={({ pressed }) => [styles.press, pressed && styles.pressed]}
          >
            <View style={styles.card}>
              <View style={[styles.photo, compact ? styles.photoCompact : null]}>{image}</View>
              <View style={styles.copy}>
                <Text style={styles.title} numberOfLines={2}>{meal.title}</Text>
                <Text style={styles.venue} numberOfLines={1}>{venueName(meal)}</Text>
                <Line icon="SewingPin">{`${areaName(meal.areaCode)}, London`}</Line>
                <Line icon="Calendar">{cardWhenLabel(meal.startsAt)}</Line>
                <Line glyph="£">{`${cardBudgetLabel(meal).replace(/^£/, '')} per person`}</Line>
                <Line icon="Person">{`Table for ${meal.capacity} · ${meal.confirmedCount} confirmed`}</Line>
                <Line icon="ChatBubble">{`${moodLabel(meal)} · ${languagesLabel(meal.languages)}`}</Line>
                <View style={styles.avatars}>
                  {people.map((p) => <Avatar key={p.id} person={p} size={compact ? 26 : 28} {...(onPerson ? { onPress: () => onPerson(p) } : {})} />)}
                </View>
              </View>
            </View>
            {status ? <Text style={styles.status}>{status}</Text> : null}
            {meal.status === 'CANCELLED' ? <Text style={styles.cancelled}>Cancelled</Text> : null}
          </Pressable>
          {attribution}
        </View>
      )}
    </RestaurantPhoto>
  );
}

/** Meta row: every line starts with the same 12pt icon column so the text aligns (price uses a £ glyph). */
function Line({ icon, glyph, children }: { icon?: IconName; glyph?: string; children: string }) {
  return (
    <View style={styles.line}>
      <View style={styles.lineIcon}>
        {icon ? <Icon name={icon} size={12} color={colors.muted} /> : glyph ? <Text style={styles.glyph}>{glyph}</Text> : null}
      </View>
      <Text style={styles.meta} numberOfLines={1}>{children}</Text>
    </View>
  );
}

const styles = createStyles({
  press: { borderRadius: 10 },
  card: { flexDirection: 'row', gap: 12 },
  pressed: { backgroundColor: '#123f3508' },
  photo: { width: 104, alignSelf: 'stretch', minHeight: 128, borderRadius: 9, overflow: 'hidden' },
  photoCompact: { width: 92, minHeight: 118 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 19, fontWeight: '700', letterSpacing: -0.4, color: colors.ink, marginBottom: 2 },
  venue: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: '#46594d', marginBottom: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  lineIcon: { width: 12, alignItems: 'center' },
  glyph: { fontSize: 11, lineHeight: 13, fontWeight: '700', color: colors.muted },
  meta: { fontSize: 11, lineHeight: 15, color: colors.muted, flexShrink: 1 },
  avatars: { flexDirection: 'row', gap: 5, marginTop: 5, alignItems: 'center' },
  status: { marginTop: 8, fontSize: 13, color: colors.forest, fontWeight: '700' },
  cancelled: { marginTop: 8, fontSize: 13, color: colors.danger, fontWeight: '700' },
});
