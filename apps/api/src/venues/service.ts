import type { PoolClient } from 'pg';
import type { Environment } from '@fancy/config';
import { DomainError } from '../common/errors.ts';
import { validatePlaceId, validateSearch, type Place, type PlacesProvider, type VenueSearch } from './provider.ts';

/** Durable data: only opaque place ID and app-owned reference/area declaration. */
export interface VenueReferences {
  findOrCreate(placeId: string, client: Pick<PoolClient, 'query'>): Promise<{ venueRef: string; areaCode: string }>;
}
export class VenueService {
  readonly provider: PlacesProvider;
  private readonly references: VenueReferences;
  constructor(environment: Environment, provider: PlacesProvider, references: VenueReferences) {
    if (provider.kind === 'fixture' && environment !== 'development' && environment !== 'test') throw new Error('Fixture Places is forbidden outside development/test');
    this.provider = provider;
    this.references = references;
  }
  async search(input: VenueSearch) { validateSearch(input); return this.provider.search(input); }
  async details(placeId: string): Promise<Place> {
    validatePlaceId(placeId);
    const place = await this.provider.details(placeId);
    if (!place) throw new DomainError('NOT_FOUND', 'This restaurant can no longer be verified. Choose another restaurant.');
    return place;
  }
  async confirm(placeId: string, client: Pick<PoolClient, 'query'>) {
    // Never trust client-supplied name/address/coordinates. Revalidate on every fresh intent.
    const place = await this.details(placeId);
    return this.confirmVerified(place.placeId,client);
  }
  /** Only called after request-scoped provider verification, inside the actor-locked transaction. */
  async confirmVerified(placeId:string,client:Pick<PoolClient,'query'>){
    validatePlaceId(placeId);
    const reference = await this.references.findOrCreate(placeId, client);
    // Idempotency envelopes are durable: exclude all provider display content from this write.
    return { ...reference, placeId, available: true, name: null, address: null, location: null, attributions: [], displayExpiresAt: null };
  }
}
