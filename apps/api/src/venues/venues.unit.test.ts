import { Client } from 'pg';
import { describe, it, expect, vi } from 'vitest';
import { GooglePlacesProvider } from './google-provider.ts';
import { FixturePlacesProvider } from './fixture-provider.ts';
import { VenueService } from './service.ts';
import { UnavailablePlacesProvider, validatePlaceId, validateSearch } from './provider.ts';
const client = new Client();
const reference = { venueRef: '00000000-0000-4000-8000-000000000001', areaCode: 'london' };
const googlePlace = { id: 'ChIJ_test', displayName: { text: 'Restaurant' }, formattedAddress: 'London', location: { latitude: 51.5, longitude: -0.1 }, types: ['restaurant'], businessStatus: 'OPERATIONAL' };
function mockFetch(result: unknown, status = 200) { return vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(result), { status })); }

describe('Places server adapter', () => {
  it('refuses fixture mode in production and staging at both provider and service boundaries', () => {
    expect(() => new FixturePlacesProvider('production')).toThrow();
    expect(() => new FixturePlacesProvider('staging')).toThrow();
    expect(() => new VenueService('production', new FixturePlacesProvider('test'), {current:async()=>null, findOrCreate: async () => reference })).toThrow();
  });
  it('uses explicit masks, server header key, restaurant filtering and bounds without exposing key in URL', async () => {
    const fetcher = mockFetch({ places: [googlePlace, { ...googlePlace, id: 'closed', businessStatus: 'CLOSED_PERMANENTLY' }, { ...googlePlace, id: 'other', types: ['park'] }], nextPageToken: 'next_token' });
    const provider = new GooglePlacesProvider('sentinel-private', fetcher);
    const result = await provider.search({ q: 'rice', bounds: { north: 52, south: 51, east: 0, west: -1 } });
    expect(result.places.map((p) => p.placeId)).toEqual(['ChIJ_test']);
    expect(result.nextCursor).toBe('next_token');
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(init?.headers).toMatchObject({ 'X-Goog-Api-Key': 'sentinel-private' });
    expect((init?.headers as Record<string, string>)['X-Goog-FieldMask']).not.toContain('*');
    expect(JSON.parse(init?.body as string)).toMatchObject({ strictTypeFiltering: true, locationRestriction: { rectangle: { low: { latitude: 51, longitude: -1 } } } });
    expect(JSON.stringify(result)).not.toContain('sentinel-private');
  });
  it('details freshly queries provider; unknown/closed IDs cannot be confirmed or persisted', async () => {
    const fetcher = mockFetch(googlePlace);
    const repository = {current:async()=>null, findOrCreate: vi.fn(async () => reference) };
    const service = new VenueService('test', new GooglePlacesProvider('key', fetcher), repository);
    await service.details('ChIJ_test');
    const venue = await service.confirm('ChIJ_test', client);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(venue).toEqual({ ...reference, placeId: 'ChIJ_test', available: true, name: null, address: null, location: null, attributions: [], displayExpiresAt: null });
    expect(repository.findOrCreate).toHaveBeenCalledWith('ChIJ_test', client,{placeId:'ChIJ_test',baseline:null,areaCode:'unknown',areaVersion:null,areaRevision:0});
    fetcher.mockResolvedValue(new Response('{}', { status: 404 }));
    await expect(service.confirm('unknown', client)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(repository.findOrCreate).toHaveBeenCalledTimes(1);
  });
  it('maps provider errors to safe unavailable without response body, raw errors or credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('sentinel-private'));
    const p = new GooglePlacesProvider('key', fetcher);
    await expect(p.search({})).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', message: 'Restaurant information is temporarily unavailable.' });
    await expect(new UnavailablePlacesProvider().details()).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
  it('rejects path injection and incomplete/inverted geography before a provider call', () => {
    for (const id of ['../secret', 'x?key=y', 'https://evil', '', 'a'.repeat(513)]) expect(() => validatePlaceId(id)).toThrow();
    expect(validatePlaceId('nonChIJ_opaque-123')).toBe('nonChIJ_opaque-123');
    expect(() => validateSearch({ bounds: { north: 50, south: 51, east: 1, west: 0 } })).toThrow();
    expect(() => validateSearch({ q: '   ' })).toThrow();
  });
  it('fixture results visibly identify themselves and use identical query and map filters', async () => {
    const p = new FixturePlacesProvider('test');
    const result = await p.search({ q: 'North', bounds: { north: 51.53, south: 51.51, east: 0, west: -1 } });
    expect(result.places).toHaveLength(1);
    expect(result.places[0]!.name).toContain('[Fixture]');
    result.places[0]!.name = 'mutated';
    expect((await p.details('fixture_fancy_north'))!.name).toContain('[Fixture]');
  });
});
