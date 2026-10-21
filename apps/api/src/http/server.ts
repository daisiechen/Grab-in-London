import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import { latestMigration } from '@fancy/db';
import type { AppDeps } from './context.ts';
import { errorBody, errorHandler } from './errors.ts';
import { validatorCompiler } from './validation.ts';
import { registerIdentityRoutes } from '../identity/routes.ts';

export async function buildServer(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: deps.config.environment === 'test' ? 'silent' : deps.config.logLevel,
      // Credentials, codes and message bodies never reach logs.
      redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-csrf-token"]', 'res.headers["set-cookie"]'], remove: true },
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
  return app;
}
