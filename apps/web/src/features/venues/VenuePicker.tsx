import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '@fancy/client';
import { ChevronDownIcon, ChevronUpIcon, Cross2Icon, MagnifyingGlassIcon, SewingPinFilledIcon, SewingPinIcon } from '@radix-ui/react-icons';
import { useApi } from '../../api/ApiProvider.tsx';
import { Intent } from '../../api/webApi.ts';
import { errorMessage } from '../../api/errors.ts';
import type { Venue, VenueCandidate } from '../../api/types.ts';
import { FormMessage, Primary, TextAction } from '../../ui/components.tsx';
import { GoogleMap } from '../maps/GoogleMap.tsx';
import type { Bounds } from '../maps/googleMaps.ts';
import { Hint, InlineLink, Section } from '../create/CreateLayout.tsx';
import { VenuePhoto } from './VenuePhoto.tsx';

/** Shared transient Google Maps viewport; G-PLACES still requires live credential verification. */
export type { Bounds } from '../maps/googleMaps.ts';

/** Central London, the same first area as the iOS picker's illustrated map. */
export const INITIAL_PICKER_BOUNDS: Bounds = { north: 51.5261, south: 51.4996, east: -0.108, west: -0.1618 };
/** Rows shown before “Show all”, so the list and the confirm button stay close to the map. */
const LIST_PREVIEW = 5;

/**
 * Restaurant picker (T06, iOS VenuePicker): an in-place dropdown that lists restaurants in central
 * London straight away, with an optional name search and (when configured) the Google map. Tapping
 * a row only previews it; “Use …” confirms it server-side by placeId and the confirmed identity is
 * what the draft keeps. No free-text restaurant or typed address.
 */
export function VenuePicker({ value, onConfirm }: { value: Venue | null; onConfirm: (venue: Venue) => void }) {
  const { api } = useApi();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<VenueCandidate[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [chosen, setChosen] = useState<VenueCandidate | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bounds, setBounds] = useState<Bounds>(INITIAL_PICKER_BOUNDS);
  const intent = useMemo(() => new Intent(api.retry), [api]);
  const loaded = useRef(false);

  const search = async (opts: { more?: boolean; area?: Bounds; term?: string } = {}) => {
    const term = (opts.term ?? q).trim().slice(0, 120);
    const area = opts.area ?? bounds;
    setLoading(true);
    setError('');
    try {
      const res = await api.client.call('searchVenues', {
        query: { ...(term ? { q: term } : {}), ...area, ...(opts.more && cursor ? { cursor } : {}) },
      });
      loaded.current = true;
      setResults(opts.more ? [...(results ?? []), ...res.data] : res.data);
      setCursor(res.page.nextCursor);
      if (!opts.more) setShowAll(false);
    } catch (e) {
      if (!opts.more) setResults(null);
      setError(e instanceof ApiError && e.code === 'PROVIDER_UNAVAILABLE'
        ? 'Restaurant search is temporarily unavailable. Try again shortly.'
        : errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  // Opening the picker lists the current map area at once; typing a name is optional.
  useEffect(() => {
    if (open && !loaded.current) void search();
  }, [open]);

  const submit = (e: FormEvent) => { e.preventDefault(); void search(); };
  const close = () => { setOpen(false); setChosen(null); setError(''); setShowAll(false); };

  const confirm = async (c: VenueCandidate) => {
    setBusy(true);
    setError('');
    try {
      const body = { placeId: c.placeId };
      const res = await intent.run(body, (key) => api.client.call('confirmVenue', { body, idempotencyKey: key }));
      if (!res.data.available) { setError('This restaurant can’t be verified right now. Choose another.'); return; }
      // Search display fields are transient. Confirmation returns the durable place identity;
      // the selected result stays in memory so the review stays readable.
      onConfirm({ ...res.data, name: res.data.name ?? c.name, address: res.data.address ?? c.address,
        location: res.data.location ?? c.location ?? null, attributions: c.attributions });
      close();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'NOT_FOUND'
        ? 'This restaurant can’t be verified right now. Choose another.'
        : e instanceof ApiError && e.code === 'PROVIDER_UNAVAILABLE'
          ? 'We couldn’t confirm this restaurant right now. Try again shortly.'
          : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // A previewed place stays listed even after a new search.
  const list = chosen && results && !results.some((r) => r.placeId === chosen.placeId) ? [chosen, ...results] : results ?? [];
  const visible = showAll ? list : list.slice(0, LIST_PREVIEW);
  const preview = (c: VenueCandidate) => {
    if (chosen?.placeId === c.placeId) { setChosen(null); return; }
    setChosen(c);
    if (list.indexOf(c) >= LIST_PREVIEW) setShowAll(true);
  };
  const status = loading && !results
    ? 'Finding restaurants…'
    : results === null ? null
      : list.length === 0 ? (q.trim() ? 'No restaurants found. Try another name.' : 'No restaurants in this area. Search by name instead.')
        : `${list.length}${cursor ? '+' : ''} restaurant${list.length === 1 ? '' : 's'} · choose one to preview`;
  const attributions = (results ?? []).flatMap((r) => r.attributions).filter((a, i, all) => all.findIndex((o) => o.text === a.text) === i);

  return (
    <Section required title="Restaurant" icon={<SewingPinFilledIcon />} right={value && !open ? <InlineLink label="Change" ariaLabel="Change restaurant" onClick={() => setOpen(true)} /> : null}>
      {value ? (
        value.available ? (
          <div className="vsel" aria-live="polite">
            <VenuePhoto venueRef={value.venueRef} placeId={value.placeId} label={value.name}>
              {({ image }) => <span className="vthumb">{image}</span>}
            </VenuePhoto>
            <span className="vtx">
              <b>{value.name ?? 'Selected restaurant'}</b>
              <span className="muted">{value.address ?? 'Search again to refresh the restaurant details.'}</span>
              <small>{value.attributions?.length ? `${value.attributions.map((a) => a.text).join(' · ')} · ` : ''}Choosing a place doesn’t reserve a table.</small>
            </span>
          </div>
        ) : (
          <div className="vsel" aria-live="polite">
            <span className="vtx"><b>Restaurant information temporarily unavailable</b><small>Choose again, or try later.</small></span>
          </div>
        )
      ) : (
        <button type="button" className={`vtrig${open ? ' open' : ''}`} aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
          <span className="vpin" aria-hidden="true"><SewingPinIcon /></span>
          <span className="vtx"><b>Choose a restaurant</b><span className="muted">Search by name or pick from nearby places</span></span>
          {open ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
        </button>
      )}

      {open ? (
        <div className="vdrop">
          <form className="vsearch" role="search" onSubmit={submit}>
            <MagnifyingGlassIcon aria-hidden="true" />
            <label className="vh" htmlFor="venue-q">Search restaurants</label>
            <input id="venue-q" type="search" value={q} maxLength={120} placeholder="Restaurant name (optional)" onChange={(e) => setQ(e.target.value)} autoComplete="off" />
            {q ? <button type="button" className="vclear" aria-label="Clear name" onClick={() => { setQ(''); void search({ term: '' }); }}><Cross2Icon aria-hidden="true" /></button> : null}
            <button type="submit" className="vgo" disabled={loading}>Search</button>
          </form>
          <GoogleMap label="Restaurant map" points={list.flatMap((r) => (r.location ? [{ id: r.placeId, title: r.name, location: r.location }] : []))}
            selected={chosen?.placeId ?? value?.placeId ?? null}
            onSelect={(id) => { const c = list.find((r) => r.placeId === id); if (c) preview(c); }}
            appliedBounds={bounds} onSearch={(b) => { setBounds(b); void search({ area: b }); }} />
          {status ? <p className="vstatus" role="status">{status}</p> : null}
          <FormMessage message={error} />
          {visible.length ? (
            <ol className="vlist" aria-label="Restaurant results">
              {visible.map((c, i) => {
                const previewing = chosen?.placeId === c.placeId;
                return (
                  <li key={c.placeId} className={previewing ? 'on' : ''}>
                    <button type="button" aria-pressed={previewing} onClick={() => preview(c)}>
                      <span className="vn" aria-hidden="true">{i + 1}</span>
                      <span className="vtx"><b>{c.name}</b><span className="muted">{c.address}</span></span>
                    </button>
                    {previewing ? (
                      <div className="vact">
                        <Primary busy={busy} onClick={() => void confirm(c)}>Use {c.name}</Primary>
                        <TextAction onClick={() => setChosen(null)}>Cancel selection</TextAction>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
          {!showAll && list.length > LIST_PREVIEW ? <TextAction onClick={() => setShowAll(true)}>{`Show all ${list.length} restaurants`}</TextAction> : null}
          {(showAll || list.length <= LIST_PREVIEW) && cursor ? <TextAction disabled={loading} onClick={() => void search({ more: true })}>More restaurants</TextAction> : null}
          {attributions.map((a) => <p className="attrib" key={a.text}>{a.text}</p>)}
          {value ? <TextAction onClick={close}>Keep current restaurant</TextAction> : <Hint>Choosing a place here doesn’t reserve a table; you book it with the restaurant yourself.</Hint>}
        </div>
      ) : null}
    </Section>
  );
}
