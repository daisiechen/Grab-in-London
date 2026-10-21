import { ApiError, createApiClient, type ApiClient, type RequestOf } from '@fancy/client';
import { browserLogin, LoginError, type LoginOptions } from './auth.ts';

export const MAX_INPUT_BYTES = 16_384;
export class InputError extends Error {}
type WriteIntent = { caseId: string; expectedVersion: string; intentKey: string; reason: string };
export type Command =
  | { kind: 'view'; caseId: string }
  | (WriteIntent & { kind: 'resolve'; status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED'; publicOutcome: string | null })
  | (WriteIntent & { kind: 'correct-attendance'; mealId: string; subjectId: string; value: 'present' | 'absent' });

const invalid = (): never => { throw new InputError('Invalid input.'); };
const uuid = (v: unknown): string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v) ? v : invalid();
const version = (v: unknown): string => typeof v === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(v) ? v : invalid();
const text = (v: unknown, min: number, max: number): string => typeof v === 'string' && v.length >= min && v.length <= max && v.trim().length >= min ? v : invalid();
function fields(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some(k => !Object.hasOwn(record, k)) || Object.keys(record).some(k => !keys.includes(k))) return invalid();
  return record;
}

/** Body is stdin only; argv never accepts private facts, reason, token or JSON. */
export function parseCommand(argv: readonly string[], input: string): Command {
  if (argv.length !== 1 || !['view', 'resolve', 'correct-attendance'].includes(argv[0] ?? '') || Buffer.byteLength(input) > MAX_INPUT_BYTES) return invalid();
  let raw: unknown;
  try { raw = JSON.parse(input); } catch { return invalid(); }
  const kind = argv[0];
  if (kind === 'view') { const p = fields(raw, ['caseId']); return { kind, caseId: uuid(p.caseId) }; }
  const keys = ['caseId', 'expectedVersion', 'intentKey', 'reason'];
  const p = fields(raw, [...keys, ...(kind === 'resolve' ? ['status', 'publicOutcome'] : ['mealId', 'subjectId', 'value'])]);
  const common: WriteIntent = { caseId: uuid(p.caseId), expectedVersion: version(p.expectedVersion), intentKey: uuid(p.intentKey), reason: text(p.reason, 5, 500) };
  if (kind === 'resolve') {
    if (p.status !== 'OPEN' && p.status !== 'IN_REVIEW' && p.status !== 'RESOLVED') return invalid();
    return { kind, ...common, status: p.status, publicOutcome: p.publicOutcome === null ? null : text(p.publicOutcome, 1, 1000) };
  }
  if (p.value !== 'present' && p.value !== 'absent') return invalid();
  return { kind: 'correct-attendance', ...common, mealId: uuid(p.mealId), subjectId: uuid(p.subjectId), value: p.value };
}

export function apiOriginFromEnvironment(env: Readonly<Record<string, string | undefined>>): string {
  let url: URL;
  try { url = new URL(env.FANCY_API_URL ?? ''); } catch { throw new InputError('Invalid API origin.'); }
  const local = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new InputError('Invalid API origin.');
  return url.origin;
}
export function clientFromEnvironment(env: Readonly<Record<string, string | undefined>>, fetcher?: typeof fetch): ApiClient {
  const token = env.FANCY_SUPPORT_TOKEN;
  if (!token || token.length > 8192 || /\s/.test(token)) throw new InputError('Missing credentials.');
  const origin = apiOriginFromEnvironment(env);
  const transport = fetcher ?? fetch;
  return createApiClient({ baseUrl: origin, credentials: { kind: 'bearer', accessToken: () => token }, fetch: (target, init) => transport(target, { ...init, redirect: 'error' }) });
}

/** One request per invocation. Never use withRetry for support writes. */
export async function execute(command: Command, client: ApiClient): Promise<unknown> {
  if (command.kind === 'view') return (await client.call('supportCase', { params: { caseId: command.caseId } })).data;
  if (command.kind === 'resolve') {
    const request: RequestOf<'resolveCase'> = { params: { caseId: command.caseId }, ifMatch: command.expectedVersion, idempotencyKey: command.intentKey,
      body: { status: command.status, publicOutcome: command.publicOutcome, reason: command.reason } };
    const result = await client.call('resolveCase', request);
    // Mutation responses contain private case details. Deliberately project only receipt metadata.
    return { ok: true, command: command.kind, version: version(result.data.version) };
  }
  const result = await client.call('correctAttendance', { params: { caseId: command.caseId }, idempotencyKey: command.intentKey,
    body: { mealId: command.mealId, subjectId: command.subjectId, value: command.value, reason: command.reason, expectedVersion: command.expectedVersion } });
  return { ok: true, command: command.kind, version: version(result.data.version) };
}

/** No message/stack/requestId/fieldErrors/body echo: all can contain private data. */
export function safeFailure(error: unknown): string {
  if (error instanceof LoginError) return error.message;
  if (error instanceof InputError) return 'Invalid command, JSON input or environment configuration. See README.';
  if (error instanceof ApiError) {
    if (error.kind === 'auth') return 'Authentication required. Obtain a new access token through the approved MFA login.';
    if (error.kind === 'forbidden' || error.kind === 'not_found') return 'Case unavailable or access denied. Check the case grant through the approved process.';
    if (error.kind === 'conflict' || error.kind === 'precondition') return 'State or version conflict. View the case and review before submitting a new intent.';
    if (error.retryable) return 'Request not confirmed. No automatic retry. After checking state, retry identical JSON with the same intentKey if the intent is unchanged.';
  }
  return 'Request failed. No automatic retry. No private error details were printed.';
}

export async function run(argv: readonly string[], input: string, env: Readonly<Record<string, string | undefined>>, io: { out: (value: string) => void; error: (value: string) => void }, fetcher?: typeof fetch, loginOptions?: Omit<LoginOptions, 'fetch'>): Promise<number> {
  try {
    const command = parseCommand(argv, input);
    const credentials = env.FANCY_SUPPORT_TOKEN ? env : { ...env, FANCY_SUPPORT_TOKEN: (await browserLogin(apiOriginFromEnvironment(env), { ...loginOptions, ...(fetcher ? { fetch: fetcher } : {}) })).accessToken };
    const output = await execute(command, clientFromEnvironment(credentials, fetcher));
    io.out(JSON.stringify(output));
    return 0;
  } catch (error) { io.error(safeFailure(error)); return error instanceof InputError ? 2 : 1; }
}
