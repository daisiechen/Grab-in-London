import { useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { ApiError, type ResponseOf } from '@fancy/client';
import { useServices } from '../../services.tsx';
import { Primary, TextAction } from '../../ui/Button.tsx';
import { FormMessage } from '../../ui/FormMessage.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { RestaurantPhoto } from '../../ui/RestaurantPhoto.tsx';
import { createStyles } from '../../ui/styles.ts';
import { colors } from '../../ui/tokens.ts';
import { Hint, InlineLink, Section, shared } from './CreateLayout.tsx';
import type { CreateDraft, VenueChoice } from './model.ts';

type Candidate = ResponseOf<'searchVenues'>['data'][number];

/**
 * Restaurant search → preview → explicit “Use this restaurant” (J02-R02: search text or a preview is
 * never a selection). The confirmed venue is a compact card with a fixed-size photo frame.
 */
export function VenuePicker({ draft, update }: { draft: CreateDraft; update: (patch: Partial<CreateDraft>) => void }) {
  const { api, newId } = useServices();
  const [searching, setSearching] = useState(!draft.venue);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmKeys = useRef(new Map<string, string>());

  const search = async () => {
    const term = q.trim();
    if (!term) return;
    Keyboard.dismiss();
    setIssue(null);
    setCandidate(null);
    setLoading(true);
    try {
      setResults((await api.call('searchVenues', { query: { q: term.slice(0, 120) } })).data);
    } catch (e) {
      setResults(null);
      setIssue(e instanceof ApiError && e.kind === 'unavailable' ? 'Restaurant search is temporarily unavailable. Please try again shortly.' : 'We couldn’t search restaurants. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const choose = async (c: Candidate) => {
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
        setResults(null);
        setCandidate(null);
        setQ('');
        setSearching(false);
      }
    } catch (e) {
      setIssue(e instanceof ApiError && e.kind === 'not_found' ? 'This restaurant can’t be verified right now. Choose another.' : 'We couldn’t confirm this restaurant. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const venue = draft.venue;
  return (
    <Section title="Restaurant" right={venue && !searching ? <InlineLink label="Change" accessibilityLabel="Change restaurant" onPress={() => setSearching(true)} /> : null}>
      {venue ? (
        <View style={styles.selected} accessibilityLabel={`Selected restaurant ${venue.name}`}>
          <View style={styles.thumb}>
            <RestaurantPhoto venueRef={venue.venueRef} placeId={venue.placeId} name={venue.name} fill>{({ image }) => image}</RestaurantPhoto>
          </View>
          <View style={shared.half}>
            <Text style={shared.strong} numberOfLines={1}>{venue.name}</Text>
            <Text style={shared.muted} numberOfLines={2}>{venue.address}</Text>
            <Text style={shared.tiny}>{venue.attribution ? `${venue.attribution} · ` : ''}Choosing a place doesn’t reserve a table.</Text>
          </View>
        </View>
      ) : null}
      {searching ? (
        <>
          <View style={styles.searchRow}>
            <View style={styles.inputWrap}>
              <Icon name="MagnifyingGlass" size={14} color={colors.muted} />
              <TextInput
                accessibilityLabel="Search restaurants"
                style={styles.input}
                value={q}
                onChangeText={setQ}
                placeholder="Restaurant name or area"
                placeholderTextColor={colors.muted}
                returnKeyType="search"
                onSubmitEditing={() => void search()}
                autoCorrect={false}
              />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={() => void search()} style={styles.searchButton}>
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.searchText}>Search</Text>}
            </Pressable>
          </View>
          <FormMessage message={issue} />
          {results?.length === 0 ? <Hint>{venue ? 'No restaurants found. Try another name. Your current choice is kept.' : 'No restaurants found. Try another name or area.'}</Hint> : null}
          {results?.map((c) => {
            const open = candidate === c.placeId;
            return (
              <Pressable
                key={c.placeId}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${c.address}`}
                accessibilityState={{ selected: open }}
                onPress={() => setCandidate(open ? null : c.placeId)}
                style={[styles.result, open && styles.resultOpen]}
              >
                <Text style={shared.strong}>{c.name}</Text>
                <Text style={shared.muted} numberOfLines={2}>{c.address}</Text>
                {c.attributions.length ? <Text style={shared.tiny}>{c.attributions.map((a) => a.text).join(' · ')}</Text> : null}
                {open ? (
                  <View style={styles.resultActions}>
                    <Primary label="Use this restaurant" busy={busy} onPress={() => void choose(c)} />
                    <TextAction label="Cancel selection" onPress={() => setCandidate(null)} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {venue ? <TextAction label="Keep current restaurant" onPress={() => { setSearching(false); setResults(null); setCandidate(null); setIssue(null); }} /> : <Hint>Choosing a place here doesn’t reserve a table.</Hint>}
        </>
      ) : null}
    </Section>
  );
}

const styles = createStyles({
  selected: { flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 10 },
  thumb: { width: 56, height: 56, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.surface },
  searchRow: { flexDirection: 'row', gap: 8 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 10 },
  input: { flex: 1, fontSize: 13, letterSpacing: 0, color: colors.ink, paddingVertical: 0 },
  searchButton: { height: 40, paddingHorizontal: 14, borderRadius: 9, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center' },
  searchText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  result: { borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  resultOpen: { borderColor: colors.forest, backgroundColor: '#f2f5ee' },
  resultActions: { marginTop: 8 },
});
