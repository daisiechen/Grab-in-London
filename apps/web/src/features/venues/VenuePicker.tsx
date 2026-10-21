import { useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '@fancy/client';
import { CheckIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import type { Venue, VenueCandidate } from '../../api/types.ts';
import { FormError, Primary, TextAction } from '../../ui/components.tsx';
import { GoogleMap } from '../maps/GoogleMap.tsx';
import type { Bounds } from '../maps/googleMaps.ts';

/** Shared transient Google Maps viewport; G-PLACES still requires live credential verification. */
export type { Bounds } from '../maps/googleMaps.ts';

/**
 * Restaurant picker (T06). Candidates come from searchVenues; only the placeId is sent to
 * confirmVenue and the server's confirmed display data is what we keep. No free-text
 * restaurant entry, no address typed by the client. A new search never clears the confirmed
 * selection; "Search this area" (with a map adapter) only changes the search bounds.
 */
export function VenuePicker({ value, onConfirm, mapBounds }: {
  value: Venue | null;
  onConfirm: (venue: Venue) => void;
  mapBounds?: Bounds | null;
}) {
  const { api } = useApi();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<VenueCandidate[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [chosen, setChosen] = useState<VenueCandidate | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [areaBounds, setAreaBounds] = useState<Bounds | null>(null);
  const intent = useMemo(() => new Intent(api.retry), [api]);

  const search = async (event?: FormEvent, more = false, bounds: Bounds | null = areaBounds) => {
    event?.preventDefault();
    const term = q.trim();
    if (!term && !bounds) {
      setError('Search for a restaurant by name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.client.call('searchVenues', {
        query: { ...(term ? { q: term.slice(0, 120) } : {}), ...(bounds ?? {}), ...(more && cursor ? { cursor } : {}) },
      });
      setResults(more ? [...(results ?? []), ...res.data] : res.data);
      setCursor(res.page.nextCursor);
      if (!more&&!bounds) setChosen(null);
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'PROVIDER_UNAVAILABLE'
        ? 'Restaurant search is temporarily unavailable. Try again shortly.'
        : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!chosen) return;
    setBusy(true);
    setError('');
    try {
      const body = { placeId: chosen.placeId };
      const res = await intent.run(body, (key) => api.client.call('confirmVenue', { body, idempotencyKey: key }));
      // Search display fields are transient. Confirmation returns only the durable place
      // identity; retain the selected result in memory so the review screen stays readable.
      onConfirm({ ...res.data, name: res.data.name ?? chosen.name, address: res.data.address ?? chosen.address,
        location: res.data.location ?? chosen.location ?? null, attributions: chosen.attributions });
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'NOT_FOUND'
        ? 'This restaurant can’t be confirmed right now. Choose another one.'
        : e instanceof ApiError && e.code === 'PROVIDER_UNAVAILABLE'
          ? 'We couldn’t confirm this restaurant right now. Try again shortly.'
          : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className="venue-picker">
      <legend>Restaurant</legend>
      <form className="venue-search" role="search" onSubmit={(e) => void search(e)}>
        <label className="sr-only" htmlFor="venue-q">Search restaurants</label>
        <input id="venue-q" type="search" value={q} maxLength={120} placeholder="Search restaurants in London" onChange={(e) => setQ(e.target.value)} />
        <button type="submit" disabled={busy}><MagnifyingGlassIcon /><span className="sr-only">Search</span></button>
      </form>
      {mapBounds && (
        <TextAction onClick={() => { setAreaBounds(mapBounds); void search(undefined, false, mapBounds); }}>Search this area</TextAction>
      )}
      <GoogleMap label="Restaurant map" points={(results??[]).flatMap(r=>r.location?[{id:r.placeId,title:r.name,location:r.location}]:[])} selected={chosen?.placeId??value?.placeId??null} onSelect={id=>setChosen(results?.find(r=>r.placeId===id)??null)} appliedBounds={areaBounds} onSearch={bounds=>{setAreaBounds(bounds);void search(undefined,false,bounds);}}/>
      {results && (
        <div className="venue-map-results" aria-label="Restaurant results">
          {results.map((r) => (
            <button type="button" key={r.placeId} aria-pressed={chosen?.placeId === r.placeId} onClick={() => setChosen(r)}>
              <strong>{r.name}</strong>
              <span>{r.address}</span>
            </button>
          ))}
          {!results.length && <p className="muted">No restaurants found. Try another name.</p>}
          {cursor && <TextAction onClick={() => void search(undefined, true)}>More restaurants</TextAction>}
          {results.flatMap((r) => r.attributions).filter((a,i,all)=>all.findIndex(other=>other.text===a.text)===i).map((a, i) => <p className="attribution" key={i}>{a.text}</p>)}
        </div>
      )}
      {chosen && chosen.placeId !== value?.placeId && (
        <Primary secondary disabled={busy} onClick={() => void confirm()}>Use {chosen.name} <CheckIcon /></Primary>
      )}
      <FormError>{error}</FormError>
      <div className="venue-selection-status" aria-live="polite">
        {value ? (
          value.available ? (
            <><strong>{value.name ?? 'Selected restaurant'}</strong><p>{value.address ?? 'Search again to refresh restaurant details.'}</p><small>Confirmed with Google. Book your table with the restaurant directly.</small></>
          ) : (
            <><strong>Restaurant information temporarily unavailable</strong><small>Choose again, or try later.</small></>
          )
        ) : <small>No restaurant chosen yet.</small>}
      </div>
    </fieldset>
  );
}
