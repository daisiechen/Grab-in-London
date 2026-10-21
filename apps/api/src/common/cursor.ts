import { createHmac, timingSafeEqual } from 'node:crypto';
import { DomainError } from './errors.ts';
export interface CursorScope { actor: string; resource: string; filterHash: string; epoch: string }
type Payload = CursorScope & { key: string; expires: number };
const invalid = () => new DomainError('VALIDATION_FAILED', 'This page link is invalid or expired. Reload the list.');
export function encodeCursor(secret: string, scope: CursorScope, key: string, now = Date.now()): string {
  const payload: Payload = { ...scope, key, expires: now + 86_400_000 };
  const text = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${text}.${createHmac('sha256', secret).update(text).digest('base64url')}`;
}
export function decodeCursor(secret: string, scope: CursorScope, cursor: string, now = Date.now()): string {
  if (cursor.length > 4096) throw invalid();
  const [text, mac, extra] = cursor.split('.');
  if (!text || !mac || extra || !/^[A-Za-z0-9_-]+$/.test(text) || !/^[A-Za-z0-9_-]{43}$/.test(mac)) throw invalid();
  const expected = createHmac('sha256', secret).update(text).digest();
  const signature = Buffer.from(mac, 'base64url');
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw invalid();
  try {
    const p = JSON.parse(Buffer.from(text, 'base64url').toString('utf8')) as Payload;
    if (!p || typeof p.key !== 'string' || !Number.isFinite(p.expires) || p.expires <= now || p.expires > now + 86_400_000 || Object.entries(scope).some(([k, v]) => p[k as keyof CursorScope] !== v)) throw invalid();
    return p.key;
  } catch { throw invalid(); }
}
