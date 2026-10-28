import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices } from '../../services.tsx';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { RestaurantPhoto } from '../../ui/RestaurantPhoto.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { sameBounds, type MapBounds } from '../discover/map-region.ts';
import { Hint, InlineLink, Section, shared } from './CreateLayout.tsx';
import type { CreateDraft, VenueChoice } from './model.ts';
import { Reveal } from './reveal.tsx';
import { VenueMap, initialPickerBounds, type VenuePoint } from './VenueMap.tsx';

type Candidate = ResponseOf<'searchVenues'>['data'][number];

/** Wait for the map to settle / the host to stop typing before searching again. */
export const VENUE_SEARCH_DEBOUNCE_MS = 350;
/** Rows shown before “Show all”, so the list and the confirm button stay close to the map. */
const LIST_PREVIEW = 5;

/**
 * Restaurant picker: an in-place dropdown with a map of nearby restaurants and the same places as a
 * numbered list, loaded for the visible map area without typing (the name filter is optional).
 * Tapping a pin or a row only previews it; “Use this restaurant” confirms it server-side
 * (J02-R02: search text or a preview is never a selection).
 */
export function VenuePicker({ draft, update }: { draft: CreateDraft; update: (patch: Partial<CreateDraft>) => void }) {
  const { api, newId } = useServices();
  const [open, setOpen] = useState(false);
  const [bounds, setBounds] = useState<MapBounds>(initialPickerBounds);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [more, setMore] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmKeys = useRef(new Map<string, string>());
  const loaded = useRef(false);

  // Loads the visible map area (plus the optional name filter); the first load runs immediately.
  useEffect(() => {
    if (!open) return;
    let stale = false;
    const term = q.trim().slice(0, 120);
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.call('searchVenues', { query: { ...bounds, ...(term ? { q: term } : {}) } });
        if (stale) return;
        loaded.current = true;
        setIssue(null);
        setResults(res.data);
        setMore(Boolean(res.page?.hasMore));
      } catch (e) {
        if (stale) return;
        setResults(null);
        setIssue(e instanceof ApiError && e.kind === 'unavailable' ? 'Restaurant search is temporarily unavailable. Please try again shortly.' : 'We couldn’t load restaurants. Check your connection and try again.');
      } finally {
        if (!stale) setLoading(false);
      }
    }, loaded.current ? VENUE_SEARCH_DEBOUNCE_MS : 0);
    return () => { stale = true; clearTimeout(timer); };
  }, [api, open, bounds, q]);

  const close = () => { Keyboard.dismiss(); setOpen(false); setCandidate(null); setIssue(null); setQ(''); setShowAll(false); };

  const choose = async (c: Candidate) => {
    Keyboard.dismiss();
    setBusy(true);
    setIssue(null);
    if (!confirmKeys.current.has(c.placeId)) confirmKeys.current.set(c.placeId, newId());
    try {
      const v = (await api.call('confirmVenue', { body: { placeId: c.placeId }, idempotencyKey: confirmKeys.current.get(c.placeId)! })).data;
      if (!v.available) {
        setIssue('This restaurant can’t be verified right now. Choose another.');
      } else {
        const choice: VenueChoice = { venueRef: v.venueRef, placeId: v.placeId, name: v.name ?? c.name, address: v.address ?? c.address, attribution: c.attributions.map((a) => a.text).join(' · ') };
        update({ venue: choice });
        close();
      }
    } catch (e) {
      setIssue(e instanceof ApiError && e.kind === 'not_found' ? 'This restaurant can’t be verified right now. Choose another.' : 'We couldn’t confirm this restaurant. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // A previewed place stays listed even if the map moved away from it.
  const list = candidate && results && !results.some((r) => r.placeId === candidate.placeId) ? [candidate, ...results] : results ?? [];
  const numbered = list.map((c, i) => ({ c, n: i + 1 }));
  const points: VenuePoint[] = numbered.flatMap(({ c, n }) => (c.location ? [{ id: c.placeId, n, name: c.name, lat: c.location.lat, lng: c.location.lng }] : []));
  const preview = (id: string) => {
    Keyboard.dismiss();
    const next = list.find((c) => c.placeId === id) ?? null;
    if (!next || candidate?.placeId === id) return setCandidate(null);
    setCandidate(next);
    // A pin further down the list than the preview rows: show the whole list so its row (and confirm) appears.
    if (list.indexOf(next) >= LIST_PREVIEW) setShowAll(true);
  };
  const visible = showAll ? numbered : numbered.slice(0, LIST_PREVIEW);

  const venue = draft.venue;
  const status = loading && !results
    ? 'Finding restaurants on the map…'
    : results === null ? null
      : list.length === 0 ? (q.trim() ? 'No restaurants match in this map area. Move the map or clear the name.' : 'No restaurants in this map area. Move or zoom out the map.')
        : `${list.length}${more ? '+' : ''} restaurant${list.length === 1 ? '' : 's'} in this map area · tap a pin or a name to preview`;

  return (
    <Section title="Restaurant" icon="SewingPinFilled" right={venue && !open ? <InlineLink label="Change" accessibilityLabel="Change restaurant" onPress={() => setOpen(true)} /> : null}>
      {venue ? (
        <View style={styles.selected} accessibilityLabel={`Selected restaurant ${venue.name}`}>
          <View style={styles.thumb}>
            <RestaurantPhoto venueRef={venue.venueRef} placeId={venue.placeId} name={venue.name} fill>{({ image }) => image}</RestaurantPhoto>
          </View>
          <View style={shared.half}>
            <Text style={shared.value} numberOfLines={1}>{venue.name}</Text>
            <Text style={shared.muted} numberOfLines={2}>{venue.address}</Text>
            <Text style={shared.tiny}>{venue.attribution ? `${venue.attribution} · ` : ''}Choosing a place doesn’t reserve a table.</Text>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a restaurant on the map"
          accessibilityState={{ expanded: open }}
          onPress={() => (open ? close() : setOpen(true))}
          style={[styles.trigger, open && styles.triggerOpen]}
        >
          <View style={styles.pinCircle}><Icon name="SewingPin" size={15} color={colors.forest} /></View>
          <View style={shared.half}>
            <Text style={styles.triggerTitle}>Choose a restaurant</Text>
            <Text style={shared.muted}>Pick from the map of nearby places</Text>
          </View>
          <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={12} color={open ? colors.forest : colors.muted} />
        </Pressable>
      )}

      {open ? (
        <View style={styles.dropdown}>
          {/* The search row and map scroll into view as soon as the dropdown opens. */}
          <Reveal style={styles.top} testID="venue-dropdown">
            <View style={styles.inputWrap}>
              <Icon name="MagnifyingGlass" size={14} color={colors.muted} />
              <TextInput
                accessibilityLabel="Filter restaurants by name"
                style={styles.input}
                value={q}
                onChangeText={setQ}
                placeholder="Filter by name (optional)"
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                onSubmitEditing={() => Keyboard.dismiss()}
                autoCorrect={false}
              />
              {loading ? <ActivityIndicator size="small" color={colors.forest} accessibilityLabel="Loading restaurants" /> : null}
              {q && !loading ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear name filter" onPress={() => setQ('')} hitSlop={8}>
                  <Icon name="Cross2" size={14} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.map} testID="venue-map">
              <VenueMap points={points} activeId={candidate?.placeId ?? null} onSelect={preview} onBoundsChange={(b) => setBounds((prev) => (sameBounds(prev, b) ? prev : b))} />
            </View>
          </Reveal>
          {status ? <Text style={styles.status} accessibilityLiveRegion="polite">{status}</Text> : null}
          <FormMessage message={issue} />
          {visible.map(({ c, n }) => {
            const previewing = candidate?.placeId === c.placeId;
            return (
              <Pressable
                key={c.placeId}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${c.address}`}
                accessibilityState={{ selected: previewing }}
                onPress={() => preview(c.placeId)}
                style={[styles.row, previewing && styles.rowOpen]}
              >
                <View style={styles.rowHead}>
                  <View style={[styles.badge, previewing && styles.badgeOn]}><Text style={[styles.badgeText, previewing && styles.badgeTextOn]}>{n}</Text></View>
                  <View style={shared.half}>
                    <Text style={shared.value} numberOfLines={1}>{c.name}</Text>
                    <Text style={shared.muted} numberOfLines={1}>{c.address}</Text>
                    {c.attributions.length ? <Text style={shared.tiny}>{c.attributions.map((a) => a.text).join(' · ')}</Text> : null}
                  </View>
                </View>
                {previewing ? (
                  // Scrolls into view as soon as a pin or row is tapped, so confirming is one fluid action.
                  <Reveal style={styles.rowActions} testID="venue-confirm">
                    <Primary label="Use this restaurant" busy={busy} onPress={() => void choose(c)} />
                    <TextAction label="Cancel selection" onPress={() => setCandidate(null)} />
                  </Reveal>
                ) : null}
              </Pressable>
            );
          })}
          {!showAll && numbered.length > LIST_PREVIEW ? <TextAction label={`Show all ${numbered.length} restaurants`} onPress={() => setShowAll(true)} /> : null}
          {venue ? <TextAction label="Keep current restaurant" onPress={close} /> : <Hint>Choosing a place here doesn’t reserve a table; you book it with the restaurant yourself.</Hint>}
        </View>
      ) : null}
    </Section>
  );
}

// White hairline boxes so the picker stands out on the section's surface card.
const styles = createStyles({
  selected: { flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, backgroundColor: colors.white },
  thumb: { width: 56, height: 56, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.surface },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.white },
  triggerOpen: { borderColor: colors.forest, backgroundColor: colors.selectedSurface },
  pinCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.selectedSurface, alignItems: 'center', justifyContent: 'center' },
  triggerTitle: { fontSize: 15, fontWeight: '600', color: colors.forest },
  dropdown: { gap: 8 },
  top: { gap: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 10, backgroundColor: colors.white },
  input: { flex: 1, fontSize: 14, letterSpacing: 0, color: colors.ink, paddingVertical: 0 },
  map: { height: 200, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: '#eeeee5' },
  status: { fontSize: 11, lineHeight: 15, color: colors.muted },
  row: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 10, backgroundColor: colors.white },
  rowOpen: { borderColor: colors.forest, backgroundColor: colors.selectedSurface },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  badgeOn: { backgroundColor: colors.peach },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.white },
  badgeTextOn: { color: colors.ink },
  rowActions: { marginTop: 8 },
});
