import { DomainError } from '../common/errors.ts';

export interface Bounds { north: number; south: number; east: number; west: number }
export interface VenueSearch { q?: string; bounds?: Bounds; cursor?: string }
export interface Place {
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  photoRefs: string[];
  attributions: { provider: 'google'; text: string }[];
}
export interface PlacePhoto {uri:string;source:'Google Maps';authorAttributions:{displayName:string;uri:string|null}[]}
export interface PlacesProvider {
  readonly kind: 'google' | 'fixture' | 'unavailable';
  search(input: VenueSearch): Promise<{ places: Place[]; nextCursor: string | null }>;
  details(placeId: string): Promise<Place | null>;
  photo?(placeId:string):Promise<PlacePhoto|null>;
}
export function validatePlaceId(placeId: string): string {
  // IDs are opaque; do not assume every Google identifier begins with ChIJ.
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(placeId)) throw new DomainError('VALIDATION_FAILED', 'Invalid restaurant identifier.');
  return placeId;
}
export function validateSearch(input: VenueSearch): void {
  if (input.q !== undefined && (!input.q.trim() || input.q.length > 120)) throw new DomainError('VALIDATION_FAILED', 'Enter a restaurant search.');
  if (input.cursor !== undefined && (input.cursor.length > 4096 || !/^[A-Za-z0-9_=-]+$/.test(input.cursor))) throw new DomainError('VALIDATION_FAILED', 'Invalid search cursor.');
  const b = input.bounds;
  if (b && (!Object.values(b).every(Number.isFinite) || b.north > 90 || b.south < -90 || b.north <= b.south || b.east > 180 || b.east < -180 || b.west > 180 || b.west < -180 || b.east === b.west)) throw new DomainError('VALIDATION_FAILED', 'Invalid map bounds.');
}
export const placesUnavailable = () => new DomainError('PROVIDER_UNAVAILABLE', 'Restaurant information is temporarily unavailable.', { retryAfterSeconds: 30 });
export class UnavailablePlacesProvider implements PlacesProvider {
  readonly kind = 'unavailable' as const;
  async search(): Promise<{ places: Place[]; nextCursor: string | null }> { throw placesUnavailable(); }
  async details(): Promise<Place | null> { throw placesUnavailable(); }
}
