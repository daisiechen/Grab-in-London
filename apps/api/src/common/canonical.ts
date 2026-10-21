import { createHash } from 'node:crypto';

/** Deterministic JSON: object keys sorted recursively, undefined dropped (as JSON does). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** Request fingerprint for idempotency: method, concrete path, If-Match and canonical body. */
export function requestHash(r: { method: string; path: string; ifMatch?: string | null; body?: unknown }): string {
  return createHash('sha256')
    .update(`${r.method.toUpperCase()}\n${r.path}\n${r.ifMatch ?? ''}\n${canonicalJson(r.body ?? null)}`)
    .digest('hex');
}
