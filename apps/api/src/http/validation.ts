/**
 * Request validation: bodies are strict (no coercion, no removal of unknown fields, so unknown
 * write fields are rejected); query/path strings are coerced to the declared scalar types.
 */
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import type { FastifySchemaCompiler } from 'fastify';

const addFormats = addFormatsImport as unknown as (ajv: Ajv2020) => Ajv2020;
const base = { allErrors: true, removeAdditional: false, useDefaults: false, strict: true } as const;
const strictAjv = addFormats(new Ajv2020({ ...base, coerceTypes: false }));
const coercingAjv = addFormats(new Ajv2020({ ...base, coerceTypes: true }));

export const validatorCompiler: FastifySchemaCompiler<object> = ({ schema, httpPart }) => {
  const ajv = httpPart === 'body' || httpPart === 'headers' ? strictAjv : coercingAjv;
  const validate = ajv.compile(schema);
  return (data: unknown) => (validate(data) ? { value: data } : { error: Object.assign(new Error('validation failed'), { validation: validate.errors, validationContext: httpPart }) });
};
