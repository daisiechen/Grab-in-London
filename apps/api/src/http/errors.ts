import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError, FencingError } from '../common/errors.ts';

export interface ErrorBody {
  error: { code: string; message: string; fieldErrors?: Record<string, string>; retryAfterSeconds?: number; currentVersion?: string; choices?: unknown[] };
  meta: { requestId: string; serverNow: string };
}

export function errorBody(request: FastifyRequest, code: string, message: string, extra: Partial<ErrorBody['error']> = {}): ErrorBody {
  return { error: { code, message, ...extra }, meta: { requestId: request.id, serverNow: new Date().toISOString() } };
}

/** Body for a DomainError; also what an idempotent write stores as its stable rejection. */
export function domainErrorBody(request: FastifyRequest, error: DomainError): ErrorBody {
  const { currentVersion, fieldErrors, retryAfterSeconds, choices } = error.details;
  return errorBody(request, error.code, error.message, {
    ...(currentVersion !== undefined ? { currentVersion } : {}),
    ...(fieldErrors ? { fieldErrors } : {}),
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    ...(choices ? { choices } : {}),
  });
}

type AjvIssue = { instancePath?: string; keyword?: string; params?: Record<string, unknown>; message?: string };

/** Maps every failure to the contract envelope; unexpected errors never leak SQL/provider detail. */
export function errorHandler(error: FastifyError & { validation?: AjvIssue[]; validationContext?: string }, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof DomainError) {
    if (error.details.retryAfterSeconds !== undefined) reply.header('retry-after', String(error.details.retryAfterSeconds));
    return reply.status(error.status).send(domainErrorBody(request, error));
  }
  if (error instanceof FencingError) {
    reply.header('retry-after', '1');
    return reply.status(409).send(errorBody(request, 'INTENT_IN_PROGRESS', 'This request is still being processed.', { retryAfterSeconds: 1 }));
  }
  if (error.validation) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.validation) {
      const extra = issue.keyword === 'additionalProperties' ? `/${String(issue.params?.additionalProperty)}` : '';
      const path = `${error.validationContext ?? 'body'}${issue.instancePath ?? ''}${extra}`.replace(/\//g, '.');
      fieldErrors[path.slice(0, 120)] = issue.keyword === 'additionalProperties' ? 'Unknown field' : (issue.message ?? 'Invalid value').slice(0, 300);
    }
    return reply.status(422).send(errorBody(request, 'VALIDATION_FAILED', 'Some fields need attention.', { fieldErrors }));
  }
  if (error.statusCode === 400 || error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' || error.code === 'FST_ERR_CTP_EMPTY_JSON_BODY') {
    return reply.status(400).send(errorBody(request, 'INVALID_REQUEST', 'The request could not be read.'));
  }
  if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.status(400).send(errorBody(request, 'INVALID_REQUEST', 'The request is too large.'));
  if (error.statusCode === 404) return reply.status(404).send(errorBody(request, 'NOT_FOUND', 'Not found.'));
  request.log.error({ err: { name: error.name, code: error.code } }, 'unexpected error');
  return reply.status(500).send(errorBody(request, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'));
}
