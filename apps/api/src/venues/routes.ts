import { createHash } from 'node:crypto';
import { decodeCursor,encodeCursor } from '../common/cursor.ts';
import { lockActiveActor } from '../common/actor.ts';
import type { FastifyInstance } from 'fastify';
import { DomainError } from '../common/errors.ts';
import type { AppDeps } from '../http/context.ts';
import { defineRoute, defineWrite } from '../http/routes.ts';
import type { VenueSearch } from './provider.ts';
import type { PreparedVenueConfirmation,VenueService } from './service.ts';

export function registerVenueRoutes(app: FastifyInstance, deps: AppDeps, service: VenueService): void {
  defineRoute(app, deps, 'searchVenues', async ({ request }) => {
    const q = request.query as { q?: string; north?: number; south?: number; east?: number; west?: number; cursor?: string };
    const values = [q.north, q.south, q.east, q.west];
    const count = values.filter((v) => v !== undefined).length;
    if (count !== 0 && count !== 4) throw new DomainError('VALIDATION_FAILED', 'All four map bounds are required.');
    const filterHash = createHash('sha256').update(JSON.stringify(Object.entries(q).filter(([key]) => key !== 'cursor').sort(([a],[b]) => a.localeCompare(b)))).digest('hex');
    const scope = { actor: 'public', resource: 'searchVenues', filterHash, epoch: 'places-v1' };
    const input: VenueSearch = {
      ...(q.q !== undefined ? { q: q.q } : {}), ...(q.cursor !== undefined ? { cursor: decodeCursor(deps.config.sessionSecret, scope, q.cursor) } : {}),
      ...(count === 4 ? { bounds: { north: q.north!, south: q.south!, east: q.east!, west: q.west! } } : {}),
    };
    const result = await service.search(input);
    return { data: result.places, page: { nextCursor: result.nextCursor === null ? null : encodeCursor(deps.config.sessionSecret, scope, result.nextCursor), hasMore: result.nextCursor !== null } };
  });
  defineWrite<PreparedVenueConfirmation>(app, deps, 'confirmVenue', async ({ auth, prepared }, tx) => {
    await lockActiveActor(tx, auth.userId);
    const data = await service.confirmVerified(prepared, tx.client);
    return { data, resourceId: data.venueRef };
  },undefined,async({request})=>service.prepareConfirmation((request.body as {placeId:string}).placeId,deps.pool));
}
