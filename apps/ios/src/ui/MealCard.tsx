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
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={[styles.photo, compact ? styles.photoCompact : null]}>{image}</View>
            <View style={styles.copy}>
              <Text style={styles.title}>{meal.title}</Text>
              <Text style={styles.venue}>{venueName(meal)}</Text>
              <Line icon="SewingPin">{`${areaName(meal.areaCode)}, London`}</Line>
              <Line icon="Calendar">{cardWhenLabel(meal.startsAt)}</Line>
              <Line>{`${cardBudgetLabel(meal)} per person`}</Line>
              <Line icon="Person">{`Table for ${meal.capacity} · ${meal.confirmedCount} confirmed`}</Line>
              <View style={styles.avatars}>
                {people.map((p) => <Avatar key={p.id} person={p} size={compact ? 29 : 32} {...(onPerson ? { onPress: () => onPerson(p) } : {})} />)}
              </View>
            </View>
          </Pressable>
          {attribution}
          {status ? <Text style={styles.status}>{status}</Text> : null}
          {meal.status === 'CANCELLED' ? <Text style={styles.cancelled}>Cancelled</Text> : null}
          {compact ? (
            <View style={styles.pill}><Text style={styles.pillText}>{moodLabel(meal)}</Text></View>
          ) : (
            <Text style={styles.caption}>{`${moodLabel(meal)} · ${languagesLabel(meal.languages)}`}</Text>
          )}
        </View>
      )}
    </RestaurantPhoto>
  );
}

function Line({ icon, children }: { icon?: IconName; children: string }) {
  return (
    <View style={styles.line}>
      {icon ? <Icon name={icon} size={12} color={colors.muted} /> : null}
      <Text style={styles.meta}>{children}</Text>
    </View>
  );
}

const styles = createStyles({
  card: { flexDirection: 'row', gap: 13, borderRadius: 10 },
  pressed: { backgroundColor: '#123f3508' },
  photo: { width: 116, minHeight: 143, maxHeight: 150, borderRadius: 9, overflow: 'hidden' },
  photoCompact: { width: 101, minHeight: 130 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, lineHeight: 19, fontWeight: '700', letterSpacing: -0.5, color: colors.ink, marginBottom: 5 },
  venue: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: '#46594d', marginBottom: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  meta: { fontSize: 11, lineHeight: 15, color: colors.muted, flexShrink: 1 },
  avatars: { flexDirection: 'row', gap: 5, marginTop: 8, alignItems: 'center' },
  caption: { marginTop: 9, fontSize: 10, color: '#5e7364' },
  pill: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f0f3ec', borderRadius: 7 },
  pillText: { fontSize: 10, lineHeight: 14, color: '#536c5b' },
  status: { marginTop: 8, fontSize: 13, color: colors.forest, fontWeight: '700' },
  cancelled: { marginTop: 8, fontSize: 13, color: colors.danger, fontWeight: '700' },
});
