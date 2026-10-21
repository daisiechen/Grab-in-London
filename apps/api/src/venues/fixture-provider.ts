/** Entirely invented restaurants; not copied from Google or Demo production claims. */
import type { Environment } from '@fancy/config';
import { validatePlaceId, validateSearch, type Place, type PlacesProvider, type VenueSearch } from './provider.ts';
const FIXTURES: Place[] = [
  { placeId: 'fixture_fancy_north', name: '[Fixture] Fancy North Kitchen', address: '[Fixture] Example street, London', location: { lat: 51.52, lng: -0.12 }, photoRefs: [], attributions: [] },
  { placeId: 'fixture_fancy_south', name: '[Fixture] Fancy South Table', address: '[Fixture] Example road, London', location: { lat: 51.49, lng: -0.1 }, photoRefs: [], attributions: [] },
];
export class FixturePlacesProvider implements PlacesProvider {
  readonly kind = 'fixture' as const;
  constructor(environment: Environment) {
    if (environment !== 'test' && environment !== 'development') throw new Error('Fixture Places is test/development only');
  }
  async search(input: VenueSearch) {
    validateSearch(input);
    if (input.cursor) return { places: [], nextCursor: null };
    const q = input.q?.trim().toLowerCase();
    const b = input.bounds;
    const places = FIXTURES.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!b || (p.location.lat <= b.north && p.location.lat >= b.south && (b.west <= b.east ? p.location.lng >= b.west && p.location.lng <= b.east : p.location.lng >= b.west || p.location.lng <= b.east))));
    return { places: structuredClone(places), nextCursor: null };
  }
  async details(placeId: string) { validatePlaceId(placeId); return structuredClone(FIXTURES.find((p) => p.placeId === placeId) ?? null); }
}
