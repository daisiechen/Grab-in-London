import { registerProfileRoutes } from '../profiles/routes.ts';
import { registerSurveyRoutes } from '../surveys/routes.ts';
import { registerMealRoutes } from '../meals/routes.ts';
import { registerConversationRoutes } from '../conversations/routes.ts';
import { registerAdminRoutes } from '../admin/routes.ts';
import { registerSupportRoutes } from '../support/routes.ts';
import { registerAnalyticsIngest } from '../admin/ingest.ts';
import { AssistantRuntime } from '../../../../packages/assistant/src/index.ts';
import { registerPostMealRoutes } from '../post-meal/routes.ts';
import { registerConnectionRoutes } from '../connections/routes.ts';
import { registerDeletionRoutes } from '../deletion/routes.ts';
import { SessionService } from '../assistant/sessions.ts';
import { AssistantController } from '../assistant/controller.ts';
import { registerAssistantRoutes } from '../assistant/routes.ts';
import { startAssistantLifecycle } from '../assistant/lifecycle.ts';
import {DomainError} from '../common/errors.ts';
import { registerExportRoutes } from '../admin/exports.ts';
import { registerVenueRoutes } from '../venues/routes.ts';
import { VenueService } from '../venues/service.ts';
import { PostgresVenueReferences } from '../venues/repository.ts';
import { FixturePlacesProvider } from '../venues/fixture-provider.ts';
import { UnavailablePlacesProvider } from '../venues/provider.ts';
import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { latestMigration } from '@fancy/db';
import type { AppDeps } from './context.ts';
import { errorBody, errorHandler } from './errors.ts';
import { validatorCompiler } from './validation.ts';
import { registerIdentityRoutes } from '../identity/routes.ts';

export async function buildServer(deps: AppDeps): Promise<FastifyInstance> {
  deps.assistantRuntime ??= new AssistantRuntime();
  const app = Fastify({
    logger: {
      level: deps.config.environment === 'test' ? 'silent' : deps.config.logLevel,
      // Credentials, codes and message bodies never reach logs.
      redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-csrf-token"]', 'req.headers["ai-device-token"]', 'res.headers["set-cookie"]'], remove: true },
    },
    genReqId: () => randomUUID(),
    bodyLimit: 64 * 1024,
    trustProxy: false,
    ajv: { customOptions: { removeAdditional: false } },
  });
  await app.register(cookie);
  app.setValidatorCompiler(validatorCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request, reply) => reply.status(404).send(errorBody(request, 'NOT_FOUND', 'Not found.')));
  app.decorateRequest('auth', null);
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
    if (request.url.startsWith('/v1/')) reply.header('cache-control', 'private, no-store');
  });

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      const { rows } = await deps.pool.query<{ version: string }>(`SELECT max(version) AS version FROM schema_migrations`);
      const ready = rows[0]?.version === latestMigration();
      return reply.status(ready ? 200 : 503).send({ status: ready ? 'ready' : 'migrations_pending' });
    } catch {
      return reply.status(503).send({ status: 'database_unavailable' });
    }
  });

  registerIdentityRoutes(app, deps);
  registerProfileRoutes(app, deps);
  registerSurveyRoutes(app, deps);
  const places = deps.placesProvider ?? (deps.config.adapters.PLACES_ADAPTER === 'fixture'
    ? new FixturePlacesProvider(deps.config.environment) : new UnavailablePlacesProvider());
  const venues = new VenueService(deps.config.environment, places,
    new PostgresVenueReferences(places.kind === 'fixture' ? 'fixture' : 'google'));
  registerVenueRoutes(app, deps, venues);
  registerMealRoutes(app, deps, venues);
  registerConversationRoutes(app, deps);
  registerPostMealRoutes(app, deps);
  registerConnectionRoutes(app, deps);
  registerDeletionRoutes(app, deps);
  registerAdminRoutes(app, deps);
  registerExportRoutes(app, deps);
  registerAnalyticsIngest(app, deps);
  registerSupportRoutes(app, deps);
  const assistant = new AssistantController({ allowedAreas: [], ...deps.assistant, pool: deps.pool, sessions: new SessionService(deps.pool, deps.assistantRuntime), secret: deps.config.sessionSecret,
    venueDisplay:async venueRef=>{
      const {rows:[reference]}=await deps.pool.query<{place_id:string}>(`SELECT place_id FROM venues WHERE id=$1`,[venueRef]);
      if(!reference)throw new DomainError('NOT_FOUND','Venue unavailable.');
      const place=await venues.details(reference.place_id);return {name:place.name,location:place.location};
    } });
  registerAssistantRoutes(app, deps, assistant);
  const stopAssistant = await startAssistantLifecycle(deps.assistantRuntime, assistant.requests, assistant.budget);
  app.addHook('onClose', stopAssistant);
  return app;
}
