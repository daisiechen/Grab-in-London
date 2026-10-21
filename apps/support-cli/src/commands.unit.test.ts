import { describe, expect, it, vi } from 'vitest';
import { clientFromEnvironment, execute, parseCommand, run, safeFailure, MAX_INPUT_BYTES } from './commands.ts';
import { ApiError } from '@fancy/client';

const caseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const intentKey = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const common = { caseId, intentKey, expectedVersion: '12', reason: 'Reviewed attendance evidence privately.' };
const resolve = { ...common, status: 'RESOLVED', publicOutcome: 'Your report has been reviewed.' };
const correction = { ...common, mealId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', subjectId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', value: 'present' };
const env = { FANCY_API_URL: 'https://api.example.test', FANCY_SUPPORT_TOKEN: 'opaque-private-token' };
const response = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } });

describe('support CLI strict stdin commands', () => {
  it('parses all three exact shapes and keeps explicit intent and versions', () => {
    expect(parseCommand(['view'], JSON.stringify({ caseId }))).toEqual({ kind: 'view', caseId });
    expect(parseCommand(['resolve'], JSON.stringify(resolve))).toEqual({ kind: 'resolve', ...resolve });
    expect(parseCommand(['correct-attendance'], JSON.stringify(correction))).toEqual({ kind: 'correct-attendance', ...correction });
  });
  it('rejects unknown keys, private argv, missing intent/version/reason, invalid enums and invalid versions', () => {
    const invalid = [ { ...resolve, token: 'secret' }, { ...resolve, expectedVersion: 12 }, { ...resolve, expectedVersion: '-1' },
      { ...resolve, intentKey: undefined }, { ...resolve, reason: '' }, { ...resolve, status: 'DONE' } ];
    for (const body of invalid) expect(() => parseCommand(['resolve'], JSON.stringify(body))).toThrow();
    expect(() => parseCommand(['view'], JSON.stringify({ caseId, reason: 'private' }))).toThrow();
    expect(() => parseCommand(['view', 'private-text'], JSON.stringify({ caseId }))).toThrow();
    expect(() => parseCommand(['login'], '{}')).toThrow();
    expect(() => parseCommand(['view'], 'not json private-text')).toThrow();
    expect(() => parseCommand(['view'], ' '.repeat(MAX_INPUT_BYTES + 1))).toThrow();
  });
  it('refuses insecure nonlocal origins, URL credentials, query tokens and malformed credentials', () => {
    for (const url of ['http://api.example.test', 'https://user:secret@api.example.test', 'https://api.example.test/?token=private', 'https://api.example.test/v1', 'file:///private']) {
      expect(() => clientFromEnvironment({ ...env, FANCY_API_URL: url })).toThrow();
    }
    expect(() => clientFromEnvironment({ ...env, FANCY_SUPPORT_TOKEN: 'secret\ninjection' })).toThrow();
    expect(() => clientFromEnvironment({ ...env, FANCY_SUPPORT_TOKEN: '' })).toThrow();
    expect(() => clientFromEnvironment({ ...env, FANCY_API_URL: 'http://127.0.0.1:3000' })).not.toThrow();
  });
  it('sends resolve once with bearer, If-Match and unchanged intent; only explicit repeat retries', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('secret network details')).mockResolvedValueOnce(response({ id: caseId, version: '13', details: 'private case facts' }));
    const command = parseCommand(['resolve'], JSON.stringify(resolve));
    const client = clientFromEnvironment(env, fetcher);
    await expect(execute(command, client)).rejects.toThrow(ApiError);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await execute(command, client)).toEqual({ ok: true, command: 'resolve', version: '13' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe(`https://api.example.test/v1/support/cases/${caseId}/status`);
      expect(init?.headers).toMatchObject({ authorization: 'Bearer opaque-private-token', 'if-match': '"12"', 'idempotency-key': intentKey });
      expect(JSON.parse(init?.body as string)).toEqual({ status: 'RESOLVED', publicOutcome: resolve.publicOutcome, reason: common.reason });
      expect(init?.credentials).toBe('omit');
      expect(init?.redirect).toBe('error');
    }
  });
  it('sends correction expectedVersion in body and never prints mutation case or subject details', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: { ...correction, version: '13', details: 'private' } }), { status: 201, headers: { 'content-type': 'application/json' } }));
    const out = vi.fn(), error = vi.fn();
    expect(await run(['correct-attendance'], JSON.stringify(correction), env, { out, error }, fetcher)).toBe(0);
    expect(out).toHaveBeenCalledWith(JSON.stringify({ ok: true, command: 'correct-attendance', version: '13' }));
    const init = fetcher.mock.calls[0]?.[1];
    expect(JSON.parse(init?.body as string)).toEqual({ mealId: correction.mealId, subjectId: correction.subjectId, value: 'present', reason: common.reason, expectedVersion: '12' });
    expect(init?.headers).not.toHaveProperty('if-match');
    expect(init?.headers).toHaveProperty('idempotency-key', intentKey);
    expect(error).not.toHaveBeenCalled();
  });
  it('only the explicit view command emits case facts', async () => {
    const out = vi.fn(), error = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ id: caseId, details: 'Sensitive case facts', version: '12' }));
    expect(await run(['view'], JSON.stringify({ caseId }), env, { out, error }, fetcher)).toBe(0);
    expect(out).toHaveBeenCalledWith(JSON.stringify({ id: caseId, details: 'Sensitive case facts', version: '12' }));
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty('idempotency-key');
  });
  it('does not leak errors, token, private body, requestId or field errors and never refreshes/retries', async () => {
    const secret = 'opaque-private-token PRIVATE CASE BODY';
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: secret, fieldErrors: { reason: secret } }, meta: { requestId: secret } }), { status: 403, headers: { 'content-type': 'application/json' } }));
    const out = vi.fn(), error = vi.fn();
    expect(await run(['resolve'], JSON.stringify(resolve), env, { out, error }, fetcher)).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(out).not.toHaveBeenCalled();
    expect(error.mock.calls.flat().join(' ')).not.toMatch(/opaque-private-token|PRIVATE CASE BODY|Reviewed attendance/);
    expect(safeFailure(new Error(secret))).not.toContain(secret);
    expect(safeFailure(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: secret }))).toContain('same intentKey');
  });
  it('rejects invalid input before transport and produces a fixed safe diagnostic', async () => {
    const out = vi.fn(), error = vi.fn(), fetcher = vi.fn<typeof fetch>();
    expect(await run(['resolve'], JSON.stringify({ ...resolve, accessToken: 'secret' }), env, { out, error }, fetcher)).toBe(2);
    expect(fetcher).not.toHaveBeenCalled();
    expect(out).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('Invalid command, JSON input or environment configuration. See README.');
  });
});
