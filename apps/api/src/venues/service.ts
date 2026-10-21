import type { PoolClient } from 'pg';
import type { Environment } from '@fancy/config';
import { DomainError } from '../common/errors.ts';
import {compileAreaPolygons,type AreaMapping,type AreaPolygons} from './areas.ts';
import { validatePlaceId, validateSearch, type Place, type PlacesProvider, type VenueSearch } from './provider.ts';

/** Durable data: only opaque place ID and app-owned reference/area declaration. */
export interface VenueBaseline {venueRef:string;areaCode:string;areaVersion:string|null;areaRevision:string}
export interface PreparedVenueConfirmation extends AreaMapping {placeId:string;baseline:VenueBaseline|null}
export interface VenueReferences {
  current(placeId:string,client:Pick<PoolClient,'query'>):Promise<VenueBaseline|null>;
  findOrCreate(placeId:string,client:Pick<PoolClient,'query'>,mapping:PreparedVenueConfirmation):Promise<{venueRef:string;areaCode:string}>;
}
export class VenueService {
  readonly provider: PlacesProvider;
  private readonly references: VenueReferences;
  private readonly mapArea:ReturnType<typeof compileAreaPolygons>;
  constructor(environment: Environment, provider: PlacesProvider, references: VenueReferences,areaPolygons?:AreaPolygons) {
    if (provider.kind === 'fixture' && environment !== 'development' && environment !== 'test') throw new Error('Fixture Places is forbidden outside development/test');
    this.mapArea=compileAreaPolygons(areaPolygons,environment);
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
  async prepareConfirmation(placeId:string,client:Pick<PoolClient,'query'>):Promise<PreparedVenueConfirmation>{
    validatePlaceId(placeId);
    // Capture the app-owned baseline before waiting on external provider data. Coordinates stay RAM-only.
    const baseline=await this.references.current(placeId,client);
    const place=await this.details(placeId);
    if(place.placeId!==placeId)throw new DomainError('STATE_CONFLICT','Restaurant verification changed.');
    let mapping:AreaMapping;
    try{mapping=this.mapArea(place.location);}catch{throw new DomainError('PROVIDER_UNAVAILABLE','Restaurant location is temporarily unavailable.');}
    return {placeId,...mapping,baseline};
  }
  async confirm(placeId:string,client:Pick<PoolClient,'query'>){return this.confirmVerified(await this.prepareConfirmation(placeId,client),client);}
  /** No network or provider display data in the actor-locked business transaction. */
  async confirmVerified(prepared:PreparedVenueConfirmation,client:Pick<PoolClient,'query'>){
    const placeId=validatePlaceId(prepared.placeId);
    const reference=await this.references.findOrCreate(placeId,client,prepared);
    return {...reference,placeId,available:true,name:null,address:null,location:null,attributions:[],displayExpiresAt:null};
  }
}
