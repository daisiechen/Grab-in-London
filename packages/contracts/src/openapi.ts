/** Builds the OpenAPI 3.1 document and SDK metadata from the single operation registry. */
import * as dto from './dto.ts';
import * as common from './common.ts';
import { ERROR_CODES, ERROR_STATUS } from './errors.ts';
import { errorsFor, type OperationDef } from './operation.ts';
import { API_PREFIX, CONTRACT_VERSION, operations } from './registry.ts';
import { DICTIONARY_VERSION } from './dictionaries.ts';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const NAMED: Map<object, string> = new Map();
for (const [name, schema] of [...Object.entries(dto), ...Object.entries(common)]) {
  // Only object DTOs become components; primitive aliases (Uuid, IdempotencyKey…) stay inline.
  if (schema && typeof schema === 'object' && (schema as { type?: unknown }).type === 'object' && !NAMED.has(schema)) NAMED.set(schema, name);
}

/** Plain JSON copy (drops TypeBox symbols); named DTOs become $refs except at their own definition. */
function toJson(schema: unknown, self?: object): Json {
  if (schema === null || typeof schema !== 'object') return schema as Json;
  if (schema !== self && NAMED.has(schema)) return { $ref: `#/components/schemas/${NAMED.get(schema)}` };
  if (Array.isArray(schema)) return schema.map((s) => toJson(s));
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(schema)) if (value !== undefined) out[key] = toJson(value);
  return out;
}

const envelope = (def: OperationDef): Json => {
  const data = def.success.data ? toJson(def.success.data) : null;
  if (!data) return null;
  const meta = { $ref: '#/components/schemas/Meta' };
  return def.success.list
    ? { type: 'object', additionalProperties: false, required: ['data', 'page', 'meta'], properties: { data: { type: 'array', items: data }, page: { $ref: '#/components/schemas/PageInfo' }, meta } }
    : { type: 'object', additionalProperties: false, required: ['data', 'meta'], properties: { data, meta } };
};

function parameters(def: OperationDef): Json[] {
  const params: Json[] = [];
  const add = (location: 'path' | 'query', obj?: { properties: Record<string, unknown>; required?: string[] }) => {
    for (const [name, schema] of Object.entries(obj?.properties ?? {})) {
      params.push({ name, in: location, required: location === 'path' || (obj?.required ?? []).includes(name), schema: toJson(schema) });
    }
  };
  add('path', def.params as never);
  add('query', def.query as never);
  if (def.write === 'idempotencyKey') params.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: toJson(common.IdempotencyKey) });
  if (def.ifMatch) params.push({ name: 'If-Match', in: 'header', required: true, schema: toJson(common.IfMatch) });
  if (def.method !== 'GET' && (def.auth === 'session' || def.auth === 'staff')) {
    params.push({ name: 'X-CSRF-Token', in: 'header', required: false, description: 'Required for cookie-authenticated (Web) writes', schema: { type: 'string', maxLength: 128 } });
  }
  return params;
}

export function buildOpenApi(): Json {
  const paths: Record<string, Record<string, Json>> = {};
  for (const def of operations as readonly OperationDef[]) {
    const codes = errorsFor(def);
    const responses: Record<string, Json> = {};
    const body = envelope(def);
    responses[String(def.success.status)] = def.success.status === 204
      ? { description: 'No content' }
      : body ? { description: 'Success', content: { 'application/json': { schema: body } } }
      : { description: 'Success', content: { 'text/csv': { schema: { type: 'string' } } } };
    if(def.operationId==='oauthCallback')responses['303']={
      description:'SUPPORT_CLI only: registered IPv4 loopback callback with a 60-second PKCE-bound handoff code and start transaction state; no access or refresh token.',
      headers:{Location:{required:true,schema:{type:'string',format:'uri'}},'Cache-Control':{schema:{type:'string',const:'no-store'}},'Referrer-Policy':{schema:{type:'string',const:'no-referrer'}}},
    };
    const byStatus = new Map<number, string[]>();
    for (const code of codes) byStatus.set(ERROR_STATUS[code], [...(byStatus.get(ERROR_STATUS[code]) ?? []), code]);
    for (const [status, list] of [...byStatus].sort((a, b) => a[0] - b[0])) {
      responses[String(status)] = {
        description: list.join(', '),
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
        'x-error-codes': list,
      };
    }
    const operation: Record<string, Json> = {
      operationId: def.operationId,
      summary: def.summary,
      parameters: parameters(def),
      responses,
      'x-auth': def.auth,
      'x-write-protocol': def.write,
      'x-if-match': def.ifMatch,
    };
    if (def.roles) operation['x-roles'] = [...def.roles];
    if (def.receipt) operation['x-command-receipt'] = true;
    if (def.auth === 'session' || def.auth === 'staff') operation.security = [{ sessionCookie: [] }, { bearer: [] }];
    if (def.auth === 'optionalSession') operation.security = [{}, { sessionCookie: [] }, { bearer: [] }];
    if (def.body) operation.requestBody = { required: true, content: { 'application/json': { schema: toJson(def.body) } } };
    (paths[API_PREFIX + def.path] ??= {})[def.method.toLowerCase()] = operation;
  }
  const schemas: Record<string, Json> = {};
  for (const [schema, name] of [...NAMED].sort((a, b) => a[1].localeCompare(b[1]))) schemas[name] = toJson(schema, schema);
  return {
    openapi: '3.1.0',
    info: { title: 'Fancy core API', version: CONTRACT_VERSION, 'x-dictionary-version': DICTIONARY_VERSION },
    servers: [{ url: '/' }],
    paths,
    components: {
      schemas,
      securitySchemes: {
        sessionCookie: { type: 'apiKey', in: 'cookie', name: '__Host-fancy_session' },
        bearer: { type: 'http', scheme: 'bearer', description: 'Opaque iOS/CLI access token' },
      },
    },
    'x-error-codes': Object.fromEntries(ERROR_CODES.map((c) => [c, ERROR_STATUS[c]])),
  };
}

/** Runtime metadata consumed by the SDK; types come from the same registry schemas. */
export function buildClientMetadata(): string {
  const rows = (operations as readonly OperationDef[]).map((def) => {
    const pathParams = Object.keys((def.params as { properties?: object } | undefined)?.properties ?? {});
    return `  ${def.operationId}: { method: '${def.method}', path: '${API_PREFIX}${def.path}', pathParams: [${pathParams.map((p) => `'${p}'`).join(', ')}], auth: '${def.auth}', write: '${def.write}', ifMatch: ${def.ifMatch}, receipt: ${def.receipt === true}, successStatus: ${def.success.status}, list: ${!!def.success.list}, hasBody: ${!!def.body} },`;
  });
  return [
    '// GENERATED by packages/contracts/src/generate.ts from the operation registry. Do not edit.',
    `export const CONTRACT_VERSION = '${CONTRACT_VERSION}';`,
    'export const OPERATIONS = {',
    ...rows,
    '} as const;',
    'export type OperationId = keyof typeof OPERATIONS;',
    '',
  ].join('\n');
}
