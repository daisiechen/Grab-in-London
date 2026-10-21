import type { PoolClient } from 'pg';
import {DomainError} from '../common/errors.ts';
import type { PreparedVenueConfirmation,VenueBaseline,VenueReferences } from './service.ts';

/** Uses the command's transaction client; never opens a second connection/commit. */
export class PostgresVenueReferences implements VenueReferences {
  private readonly provider: 'google' | 'fixture';
  constructor(provider: 'google' | 'fixture') { this.provider = provider; }
  async current(placeId:string,client:Pick<PoolClient,'query'>):Promise<VenueBaseline|null>{
    const {rows:[row]}=await client.query<{id:string;area_code:string;area_version:string|null;area_revision:string}>(`SELECT id,area_code,area_version,area_revision::text FROM venues WHERE place_id=$1`,[placeId]);
    return row?{venueRef:row.id,areaCode:row.area_code,areaVersion:row.area_version,areaRevision:row.area_revision}:null;
  }
  async findOrCreate(placeId:string,client:Pick<PoolClient,'query'>,mapping:PreparedVenueConfirmation){
    const baseline=mapping.baseline;
    const {rows:[row]}=await client.query<{id:string;area_code:string}>(
      `INSERT INTO venues(place_id,provider,area_code,area_version,area_revision) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(place_id) DO UPDATE SET area_code=EXCLUDED.area_code,area_version=EXCLUDED.area_version,area_revision=EXCLUDED.area_revision
       WHERE (venues.area_revision<EXCLUDED.area_revision OR (venues.area_revision=EXCLUDED.area_revision AND venues.area_version IS NOT DISTINCT FROM EXCLUDED.area_version AND venues.area_code=EXCLUDED.area_code))
       AND (($6::uuid IS NULL AND venues.area_revision=EXCLUDED.area_revision AND venues.area_version IS NOT DISTINCT FROM EXCLUDED.area_version AND venues.area_code=EXCLUDED.area_code)
        OR (venues.id=$6 AND venues.area_revision=$7 AND venues.area_version IS NOT DISTINCT FROM $8 AND venues.area_code=$9))
       RETURNING id,area_code`,[placeId,this.provider,mapping.areaCode,mapping.areaVersion,String(mapping.areaRevision),baseline?.venueRef??null,baseline?.areaRevision??null,baseline?.areaVersion??null,baseline?.areaCode??null]);
    if(!row)throw new DomainError('STATE_CONFLICT','The area mapping changed. Refresh and confirm the restaurant again.');
    return {venueRef:row.id,areaCode:row.area_code};
  }
}
