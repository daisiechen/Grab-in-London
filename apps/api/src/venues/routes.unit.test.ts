import { afterEach, describe, expect, it } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { Pool } from 'pg';
import { loadConfig } from '@fancy/config';
import { errorHandler } from '../http/errors.ts';
import { validatorCompiler } from '../http/validation.ts';
import { TestIdentityProvider } from '../identity/test-provider.ts';
import { FixturePlacesProvider } from './fixture-provider.ts';
import { registerVenueRoutes } from './routes.ts';
import { VenueService } from './service.ts';

const apps: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });
async function appForSearch() {
  const app = Fastify(); apps.push(app);
  await app.register(cookie);
  app.setErrorHandler(errorHandler);
  app.setValidatorCompiler(validatorCompiler);
  const config = loadConfig({ ENVIRONMENT: 'test', DATABASE_URL: 'postgres://localhost/unused', AUTH_ADAPTER: 'test', PLACES_ADAPTER: 'fixture', MAIL_ADAPTER: 'outbox_test', AI_PROVIDER: 'mock', WEB_ORIGIN: 'http://localhost:5174', SESSION_SECRET: 'venues-unit-test-secret-0123456789abcdef' });
  const pool = new Pool({ connectionString: config.databaseUrl });
  app.addHook('onClose', async () => { await pool.end(); });
  const service = new VenueService('test', new FixturePlacesProvider('test'), { findOrCreate: async () => { throw new Error('No writes expected'); } });
  registerVenueRoutes(app, { config, pool, identity: new TestIdentityProvider('test'), publicOrigin: config.webOrigin }, service);
  return app;
}
describe('venue route contract', () => {
  it('returns a public paginated restaurant list with numeric map-bound coercion', async () => {
    const app = await appForSearch();
    const result = await app.inject('/v1/venues?q=North&north=51.53&south=51.51&east=0&west=-1');
    expect(result.statusCode).toBe(200);
    expect(result.json().data).toHaveLength(1);
    expect(result.json().data[0].name).toContain('[Fixture]');
    expect(result.json().page).toEqual({ nextCursor: null, hasMore: false });
  });
  it('rejects partial/reversed bounds and unknown search fields', async () => {
    const app = await appForSearch();
    for (const query of ['north=52', 'north=50&south=51&east=0&west=-1', 'unknown=bad']) {
      expect((await app.inject(`/v1/venues?${query}`)).statusCode).toBe(422);
    }
  });
  it('requires authentication for confirmation and rejects injected display fields', async () => {
    const app = await appForSearch();
    const unauth = await app.inject({ method: 'POST', url: '/v1/venues/confirm', payload: { placeId: 'fixture_fancy_north' } });
    expect(unauth.statusCode).toBe(401);
    const fields = await app.inject({ method: 'POST', url: '/v1/venues/confirm', payload: { placeId: 'fixture_fancy_north', address: 'Forged client value' } });
    expect(fields.statusCode).toBe(422);
  });
});
