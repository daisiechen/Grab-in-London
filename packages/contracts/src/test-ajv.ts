// Test helper: strict Ajv matching the server's validation (no coercion of bodies, no removal of extra fields).
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import type { TSchema } from './schema.ts';

const addFormats = addFormatsImport as unknown as (ajv: Ajv2020) => Ajv2020;
export const ajv = addFormats(new Ajv2020({ strict: true, allErrors: true, removeAdditional: false, useDefaults: false, coerceTypes: false }));
export const validator = (schema: TSchema) => ajv.compile(schema);
