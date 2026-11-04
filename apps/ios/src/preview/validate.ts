/**
 * Minimal JSON-Schema checker for the contract's TypeBox request schemas (params/query/body), so the
 * preview fake rejects malformed input exactly where the real server's Ajv would (422 with
 * fieldErrors). It covers the keyword subset the operation registry uses; no `new Function`, so it
 * also runs under Hermes and in the web preview.
 */
type Schema = Record<string, unknown>;

const FORMATS: Record<string, (v: string) => boolean> = {
  uuid: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  'date-time': (v) => /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v)),
  date: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v,
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  uri: (v) => /^[a-z][a-z0-9+.-]*:[^\s]*$/i.test(v),
};

const patternCache = new Map<string, RegExp>();
function regex(pattern: string): RegExp {
  let re = patternCache.get(pattern);
  if (!re) {
    re = new RegExp(pattern, 'u');
    patternCache.set(pattern, re);
  }
  return re;
}

const typeOf = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

function typeMatches(type: string, value: unknown): boolean {
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeOf(value) === type;
}

const deepEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Returns `{ path: message }` for every violation (empty when valid). */
export function validate(schema: Schema, value: unknown, path: string, errors: Record<string, string> = {}): Record<string, string> {
  const fail = (message: string, at = path) => {
    if (!(at in errors)) errors[at.slice(0, 120)] = message;
  };
  if (typeof schema.type === 'string' && !typeMatches(schema.type, value)) {
    fail(`must be ${schema.type}`);
    return errors;
  }
  if ('const' in schema && !deepEqual(schema.const, value)) fail('must be equal to constant');
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => deepEqual(e, value))) fail('must be equal to one of the allowed values');
  if (typeof value === 'string') {
    const length = [...value].length;
    if (typeof schema.minLength === 'number' && length < schema.minLength) fail(`must NOT have fewer than ${schema.minLength} characters`);
    if (typeof schema.maxLength === 'number' && length > schema.maxLength) fail(`must NOT have more than ${schema.maxLength} characters`);
    if (typeof schema.pattern === 'string' && schema.pattern && !regex(schema.pattern).test(value)) fail(`must match pattern "${schema.pattern}"`);
    if (typeof schema.format === 'string' && FORMATS[schema.format] && !FORMATS[schema.format]!(value)) fail(`must match format "${schema.format}"`);
  }
  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) fail(`must be >= ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) fail(`must be <= ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) fail(`must NOT have fewer than ${schema.minItems} items`);
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) fail(`must NOT have more than ${schema.maxItems} items`);
    if (schema.uniqueItems === true && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) fail('must NOT have duplicate items');
    if (schema.items && typeof schema.items === 'object') value.forEach((item, i) => validate(schema.items as Schema, item, `${path}.${i}`, errors));
  }
  if (typeOf(value) === 'object') {
    const obj = value as Record<string, unknown>;
    const props = (schema.properties ?? {}) as Record<string, Schema>;
    const patterns = (schema.patternProperties ?? {}) as Record<string, Schema>;
    for (const key of (schema.required ?? []) as string[]) if (!(key in obj)) fail(`must have required property '${key}'`, `${path}.${key}`);
    const keys = Object.keys(obj);
    if (typeof schema.minProperties === 'number' && keys.length < schema.minProperties) fail(`must NOT have fewer than ${schema.minProperties} properties`);
    if (typeof schema.maxProperties === 'number' && keys.length > schema.maxProperties) fail(`must NOT have more than ${schema.maxProperties} properties`);
    for (const key of keys) {
      const child = props[key];
      if (child) {
        validate(child, obj[key], `${path}.${key}`, errors);
        continue;
      }
      const matched = Object.entries(patterns).filter(([p]) => regex(p).test(key));
      for (const [, s] of matched) validate(s, obj[key], `${path}.${key}`, errors);
      if (!matched.length && schema.additionalProperties === false) fail('Unknown field', `${path}.${key}`);
    }
  }
  if (Array.isArray(schema.anyOf)) {
    const branches = (schema.anyOf as Schema[]).map((s) => validate(s, value, path, {}));
    // Like Ajv (allErrors), a failed anyOf reports every branch's field errors, so the
    // 422 fieldErrors name the same fields as the server's.
    if (!branches.some((b) => Object.keys(b).length === 0)) {
      for (const branch of branches) for (const [at, message] of Object.entries(branch)) fail(message, at);
      fail('must match a schema in anyOf');
    }
  }
  return errors;
}

/** Querystring/path values arrive as strings; coerce scalars like Fastify's querystring parsing. */
export function coerceStrings(schema: Schema | undefined, input: Record<string, string>): Record<string, unknown> {
  const props = (schema?.properties ?? {}) as Record<string, Schema>;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    const type = props[key]?.type;
    if ((type === 'integer' || type === 'number') && raw.trim() !== '' && Number.isFinite(Number(raw))) out[key] = Number(raw);
    else if (type === 'boolean' && (raw === 'true' || raw === 'false')) out[key] = raw === 'true';
    else out[key] = raw;
  }
  return out;
}
