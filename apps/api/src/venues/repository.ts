import type { PoolClient } from 'pg';
import type { VenueReferences } from './service.ts';

/** Uses the command's transaction client; never opens a second connection/commit. */
export class PostgresVenueReferences implements VenueReferences {
  private readonly provider: 'google' | 'fixture';
  constructor(provider: 'google' | 'fixture') { this.provider = provider; }
  async findOrCreate(placeId: string, client: Pick<PoolClient, 'query'>) {
    const { rows: [row] } = await client.query<{ id: string; area_code: string }>(
      `INSERT INTO venues (place_id, provider, area_code) VALUES ($1, $2, 'unknown')
       ON CONFLICT (place_id) DO UPDATE SET place_id = EXCLUDED.place_id
       RETURNING id, area_code`, [placeId, this.provider],
    );
    if (!row) throw new Error('Venue reference was not created');
    return { venueRef: row.id, areaCode: row.area_code };
  }
}
