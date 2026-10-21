import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validate as validateOpenApi } from '@readme/openapi-parser';
import { ERROR_CODES, ERROR_STATUS } from './errors.ts';
import { errorsFor, type OperationDef } from './operation.ts';
import { operations, operationsById } from './registry.ts';
import { buildClientMetadata, buildOpenApi } from './openapi.ts';
import { ADMIN_DRILLDOWN_TARGETS, ADMIN_PAGE_KEYS, ADMIN_PAGES, CUISINES, DIETARY, MOODS, SURVEY_REASONS } from './dictionaries.ts';
import { isAllowedReturnTarget } from './return-target.ts';
import { normalizeHostDeclarations } from './declarations.ts';
import { CliCredentials, IosCredentials, ReturnTarget } from './operations/auth.ts';
import { validator } from './test-ajv.ts';

const ROOT = join(import.meta.dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const all = operations as readonly OperationDef[];
const byId = (id: string) => operationsById[id as keyof typeof operationsById];
const normalisePath = (p: string) => p.replace(/[:{][a-zA-Z]+}?/g, '{}');

describe('registry matches the reviewed API contract', () => {
  const doc = read('docs/engineering/api-and-client-contract.zh-CN.md');
  const documented = [...doc.matchAll(/([a-zA-Z]+) \/ (GET|POST|PUT|PATCH|DELETE) (\/[^\s|；]+)/g)].map((m) => ({ id: m[1]!, method: m[2]!, path: m[3]! }));

  it('defines every documented operationId with the same method and path', () => {
    expect(documented.length).toBeGreaterThanOrEqual(58);
    for (const { id, method, path } of documented) {
      const def = byId(id);
      expect(def, id).toBeDefined();
      expect(def!.method, id).toBe(method);
      expect(normalisePath(def!.path), id).toBe(normalisePath(path));
    }
  });

  it('adds only the export download route described in prose', () => {
    const extra = all.map((d) => d.operationId).filter((id) => !documented.some((d) => d.id === id));
    expect(extra.sort()).toEqual(['markConversationRead', 'getClassification', 'getExport', 'createGuestSession', 'readAIPreferences', 'replaceAIPreferences', 'deleteAIPreferences', 'bootstrapAI', 'readAI', 'activityAI', 'resetAI', 'requestAI', 'pollAI', 'validateAIDraft'].sort());
    expect(doc).toContain('GET /admin/exports/:id');
  });

  it('has unique operationIds and method+path pairs', () => {
    expect(new Set(all.map((d) => d.operationId)).size).toBe(all.length);
    expect(new Set(all.map((d) => `${d.method} ${d.path}`)).size).toBe(all.length);
  });

  it('declares every documented error code', () => {
    const listed = doc.match(/统一codes：([^。\n]+)/)![1]!.split('、').map((c) => c.trim());
    for (const code of listed) expect(ERROR_CODES, code).toContain(code);
  });
});

describe('write protocol', () => {
  const ifMatch = all.filter((d) => d.ifMatch).map((d) => d.operationId).sort();

  it('requires If-Match on edits, decisions, exits, withdrawals and support status changes', () => {
    expect(ifMatch).toEqual([
      'block', 'cancelMeal', 'classifyUser', 'declareBooking', 'decideApplication', 'dissolveGroup', 'editMeal', 'leaveGroup',
      'leaveMeal', 'putSurvey', 'rateExperience', 'reportAttendance', 'requestDeletion', 'resolveCase', 'reviewPerson',
      'revokeConnection', 'selectReconnect', 'unblock', 'updateMe', 'withdrawApplication',
      'replaceAIPreferences', 'deleteAIPreferences',
    ].sort());
    for (const id of ['createMeal', 'applyMeal', 'sendMessage', 'createReport']) expect(byId(id)!.ifMatch, id).toBe(false);
  });

  it('gives every mutating request an explicit dedupe protocol', () => {
    for (const def of all) {
      if (def.method === 'GET') expect(def.write, def.operationId).toBe('read');
      else if (def.operationId !== 'deletionStatus') expect(def.write, def.operationId).not.toBe('read');
    }
    const clientRequest = all.filter((d) => d.write === 'clientRequestId').map((d) => d.operationId).sort();
    expect(clientRequest).toEqual(['createGuestSession', 'exchangeHandoff', 'logout', 'refreshSession', 'startEmail', 'startOAuth', 'startReauth', 'verifyEmail']);
    expect(all.filter((d) => d.write === 'resourceKey').map((d) => d.operationId).sort()).toEqual(['markConversationRead', 'ingestEvents', 'sendMessage', 'replaceAIPreferences', 'deleteAIPreferences', 'bootstrapAI', 'activityAI', 'resetAI', 'requestAI', 'validateAIDraft'].sort());
  });

  it('derives transport error codes from protocol flags', () => {
    for (const def of all) {
      const codes = errorsFor(def);
      if (def.ifMatch) expect(codes).toEqual(expect.arrayContaining(['PRECONDITION_REQUIRED', 'VERSION_CONFLICT']));
      if (def.write === 'idempotencyKey') expect(codes).toEqual(expect.arrayContaining(['IDEMPOTENCY_CONFLICT', 'INTENT_IN_PROGRESS']));
      if (def.auth === 'session' || def.auth === 'staff') expect(codes).toContain('AUTH_REQUIRED');
    }
  });

  it('keeps staff endpoints behind explicit roles', () => {
    for (const def of all.filter((d) => d.path.startsWith('/admin') || d.path.startsWith('/support'))) {
      expect(def.auth, def.operationId).toBe('staff');
      expect(def.roles?.length, def.operationId).toBeGreaterThan(0);
    }
    expect(byId('classifyUser')!.roles).toEqual(['data_admin']);
  });
});

describe('schemas reject unknown fields', () => {
  /** Walks every schema node; plain objects must be closed, maps must constrain their keys. */
  function openObjects(schema: unknown, path: string, out: string[]) {
    if (!schema || typeof schema !== 'object') return;
    const node = schema as Record<string, unknown>;
    if (node.type === 'object') {
      if (node.properties && node.additionalProperties !== false) out.push(path);
      if (!node.properties && !node.patternProperties) out.push(path + ' (unconstrained map)');
    }
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value)) value.forEach((v, i) => openObjects(v, `${path}.${key}[${i}]`, out));
      else if (typeof value === 'object') openObjects(value, `${path}.${key}`, out);
    }
  }

  it('detects open objects and unconstrained maps (guard for the check below)', () => {
    const found: string[] = [];
    openObjects({ type: 'object', properties: { a: { type: 'object', properties: {}, additionalProperties: false } } }, 'open', found);
    openObjects({ type: 'object', additionalProperties: { type: 'string' } }, 'map', found);
    expect(found).toEqual(['open', 'map (unconstrained map)']);
  });

  it('closes every request and response object', () => {
    const open: string[] = [];
    for (const def of all) {
      for (const part of ['params', 'query', 'body'] as const) openObjects(def[part], `${def.operationId}.${part}`, open);
      openObjects(def.success.data, `${def.operationId}.response`, open);
    }
    expect(open).toEqual([]);
  });

  const validMeal = {
    venueRef: '6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11', title: 'Ramen night', description: 'Casual ramen and a chat about London life.',
    start: { localDate: '2026-11-07', localTime: '19:00', timeZone: 'Europe/London' },
    close: { localDate: '2026-11-07', localTime: '18:00', timeZone: 'Europe/London' },
    minimum: 3, capacity: 4, budgetMinPence: 1500, budgetMaxPence: 2500, languages: ['en', 'zh'], mood: 'EASY_CONVERSATION',
    bookingMode: 'EXTERNAL_PAY_AT_VENUE', attemptId: '0b8a7c55-4d0f-4d55-8c5a-2b0f6c9d1e22',
    bookingDeclarationConfirmed: true, reviewConfirmed: true, termsVersion: '2026-10',
  };
  const createMeal = validator(byId('createMeal')!.body!);

  it('accepts a complete createMeal body with declarations omitted or null', () => {
    expect(createMeal(validMeal)).toBe(true);
    expect(createMeal({ ...validMeal, cuisineCode: null, dietaryCodes: null })).toBe(true);
    expect(createMeal({ ...validMeal, cuisineCode: 'JAPANESE', dietaryCodes: ['VEGAN'] })).toBe(true);
  });

  it.each([
    ['unknown field', { ...validMeal, actorId: 'x' }],
    ['unticked booking declaration', { ...validMeal, bookingDeclarationConfirmed: false }],
    ['missing review confirmation', { ...validMeal, reviewConfirmed: undefined }],
    ['empty dietary array (would read as a guarantee)', { ...validMeal, dietaryCodes: [] }],
    ['unregistered cuisine', { ...validMeal, cuisineCode: 'THAI' }],
    ['unknown string as unknown', { ...validMeal, cuisineCode: 'unknown' }],
    ['duplicate languages', { ...validMeal, languages: ['en', 'en'] }],
    ['capacity above 6', { ...validMeal, capacity: 7 }],
    ['fractional pence', { ...validMeal, budgetMinPence: 15.5 }],
    ['wrong time zone', { ...validMeal, start: { ...validMeal.start, timeZone: 'Europe/Paris' } }],
    ['invalid wall time', { ...validMeal, start: { ...validMeal.start, localTime: '24:00' } }],
    ['short title', { ...validMeal, title: 'Hi' }],
    ['other booking mode', { ...validMeal, bookingMode: 'IN_APP_DEPOSIT' }],
  ])('rejects createMeal with %s', (_, body) => {
    expect(createMeal(JSON.parse(JSON.stringify(body)))).toBe(false);
  });

  it('enforces survey rules: not both empty, fixed reasons, no mealId', () => {
    const survey = validator(byId('putSurvey')!.body!);
    expect(survey({ again: true, reasons: [] })).toBe(true);
    expect(survey({ again: null, reasons: ['cost'] })).toBe(true);
    expect(survey({ again: false, reasons: SURVEY_REASONS })).toBe(true);
    expect(survey({ again: null, reasons: [] })).toBe(false);
    expect(survey({ again: true, reasons: ['cost', 'cost'] })).toBe(false);
    expect(survey({ again: true, reasons: ['price'] })).toBe(false);
    expect(survey({ again: true, reasons: [], mealId: '6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11' })).toBe(false);
  });

  it('fixes the five admin page slugs to the existing admin navigation', () => {
    const appSlugs = [...read('admin/src/App.tsx').matchAll(/^\s+"(overview|journey|supply|retention|quality|[a-z]+)",$/gm)].map((m) => m[1]).slice(0, 5);
    expect([...ADMIN_PAGES]).toEqual(appSlugs);
    const page = validator(byId('adminPage')!.params!);
    for (const slug of ADMIN_PAGES) expect(page({ page: slug })).toBe(true);
    expect(page({ page: 'users' })).toBe(false);
  });

  it('registers metric/series keys for exactly the five pages, including every prototype metric id', () => {
    expect(Object.keys(ADMIN_PAGE_KEYS)).toEqual([...ADMIN_PAGES]);
    const prototypeIds = [...read('admin/src/metrics.ts').matchAll(/^\s+id: "([a-zA-Z0-9]+)",$/gm)].map((m) => m[1]);
    expect(prototypeIds.length).toBe(11);
    for (const id of prototypeIds) expect(ADMIN_DRILLDOWN_TARGETS, id).toContain(id);
  });

  it('accepts the admin segment filter, drill-down row filters and summary exports only', () => {
    const page = validator(byId('adminPage')!.query!);
    const snapshotId = '6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11';
    expect(page({ snapshotId, segments: 'new,existing', languages: 'zh', budgetBands: '20-30,40+' })).toBe(true);
    expect(page({ snapshotId, segments: 'returning' })).toBe(false);
    expect(page({ snapshotId, budgetUpToPence: 2500 })).toBe(true);
    expect(page({ snapshotId, budgetUpToPence: 0 })).toBe(false);
    const drill = validator(byId('adminDrilldown')!.params!);
    expect(drill({ metric: 'cohort.users' })).toBe(true);
    expect(drill({ metric: 'made_up_metric' })).toBe(false);
    const drillQuery = validator(byId('adminDrilldown')!.query!);
    expect(drillQuery({ snapshotId, filterHash: 'a'.repeat(64), attendanceStatus: 'unknown', sort: 'startsAt', order: 'desc', q: 'Soho' })).toBe(true);
    expect(drillQuery({ snapshotId, filterHash: 'a'.repeat(64), sort: 'email' })).toBe(false);
    const exportBody = validator(byId('adminExport')!.body!);
    for (const metric of ['summary.overview', 'retention', 'cohort.users']) expect(exportBody({ snapshotId, metric, filters: {} }), metric).toBe(true);
    for (const metric of ['summary.users', 'cohortXusers', 'retention;DROP']) expect(exportBody({ snapshotId, metric, filters: {} }), metric).toBe(false);
  });

  it('pins survey reasons, P-05 dictionaries and moods to the reviewed contracts', () => {
    const measurement = read('docs/product/admin/measurement-contract.zh-CN.md');
    expect(measurement).toContain(SURVEY_REASONS.join('/'));
    const data = read('docs/engineering/data-and-command-contract.zh-CN.md');
    expect(data).toContain('cuisine EUROPEAN=European、JAPANESE=Japanese、SPANISH=Spanish、CHINESE=Chinese');
    expect(data).toContain('dietary VEGETARIAN_OPTIONS=Vegetarian options、VEGAN=Vegan');
    expect(Object.entries(CUISINES).map(([k, v]) => `${k}=${v}`).join('、')).toBe('EUROPEAN=European、JAPANESE=Japanese、SPANISH=Spanish、CHINESE=Chinese');
    expect(Object.keys(DIETARY)).toEqual(['VEGETARIAN_OPTIONS', 'VEGAN']);
    expect(Object.keys(MOODS)).toEqual(['EASY_CONVERSATION', 'FOOD_DISCOVERIES', 'TRAVEL_CULTURE']);
  });

  it('rejects business-success analytics events from clients', () => {
    const ingest = validator(byId('ingestEvents')!.body!);
    const event = { eventId: '6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11', type: 'detail_view', occurredAt: '2026-10-21T10:00:00Z', anonymousId: 'anon-12345', sessionId: 'sess-12345', appVersion: '1.0.0', properties: {} };
    const consent = { analytics: true, version: '2026-10-21' };
    expect(ingest({ schemaVersion: 1, consent, events: [event] })).toBe(true);
    expect(ingest({ schemaVersion: 1, events: [event] })).toBe(false);
    for (const type of ['meal_published', 'application_succeeded', 'attendance_present']) {
      expect(ingest({ schemaVersion: 1, consent, events: [{ ...event, type }] }), type).toBe(false);
    }
    expect(ingest({ schemaVersion: 1, events: [{ ...event, userId: 'spoofed' }] })).toBe(false);
  });
});

describe('auth credentials and return targets', () => {
  const ios = validator(IosCredentials);
  const cli = validator(CliCredentials);
  const token = 'a'.repeat(43);
  const at = '2026-10-21T10:15:00Z';

  it('issues refresh tokens to iOS only; the support CLI gets an access-only session', () => {
    expect(ios({ client: 'IOS', accessToken: token, accessExpiresAt: at, refreshToken: token, refreshExpiresAt: at })).toBe(true);
    expect(cli({ client: 'SUPPORT_CLI', accessToken: token, accessExpiresAt: at })).toBe(true);
    expect(cli({ client: 'SUPPORT_CLI', accessToken: token, accessExpiresAt: at, refreshToken: token, refreshExpiresAt: at })).toBe(false);
    expect(ios({ client: 'SUPPORT_CLI', accessToken: token, accessExpiresAt: at, refreshToken: token, refreshExpiresAt: at })).toBe(false);
    const handoff = validator(byId('exchangeHandoff')!.success.data!);
    expect(handoff({ client: 'SUPPORT_CLI', accessToken: token, accessExpiresAt: at, refreshToken: token, refreshExpiresAt: at })).toBe(false);
    expect(byId('refreshSession')!.success.data).toBe(IosCredentials);
  });

  const target = validator(ReturnTarget);
  it.each(['//evil.example', '//evil.example/meals', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', 'meals', ''])(
    'rejects network-path or absolute return target %j in schema and runtime', (value) => {
      expect(target(value)).toBe(false);
      expect(isAllowedReturnTarget(value)).toBe(false);
    },
  );

  it('accepts allow-listed same-origin routes and refuses others at runtime', () => {
    for (const ok of ['/', '/meals/6a1f6c32-6c4e-4c4d-9a51-6c1d0e5f9b11', '/discover?dates=2026-11-07', '/settings/survey']) {
      expect(target(ok), ok).toBe(true);
      expect(isAllowedReturnTarget(ok), ok).toBe(true);
    }
    for (const bad of ['/admin', '/mealsx', '/meals/../admin', '/%2F%2Fevil.example']) expect(isAllowedReturnTarget(bad), bad).toBe(false);
  });
});

describe('P-05 host declaration normalisation', () => {
  it('treats omitted and explicit null identically as not provided', () => {
    expect(normalizeHostDeclarations({})).toEqual({ cuisineCode: null, dietaryCodes: null });
    expect(normalizeHostDeclarations({ cuisineCode: null, dietaryCodes: null })).toEqual({ cuisineCode: null, dietaryCodes: null });
    expect(normalizeHostDeclarations({ dietaryCodes: [] })).toEqual({ cuisineCode: null, dietaryCodes: null });
  });

  it('deduplicates dietary codes in dictionary order', () => {
    expect(normalizeHostDeclarations({ cuisineCode: 'SPANISH', dietaryCodes: ['VEGAN', 'VEGETARIAN_OPTIONS', 'VEGAN'] }))
      .toEqual({ cuisineCode: 'SPANISH', dietaryCodes: ['VEGETARIAN_OPTIONS', 'VEGAN'] });
  });
});

describe('generated OpenAPI and SDK metadata', () => {
  it('is a valid OpenAPI 3.1 document', async () => {
    const spec = buildOpenApi() as Record<string, unknown>;
    expect(spec.openapi).toBe('3.1.0');
    const result = await validateOpenApi(structuredClone(spec) as never);
    expect(result.valid, JSON.stringify((result as { errors?: unknown }).errors ?? null).slice(0, 2000)).toBe(true);
  });

  it('maps each response status to the codes that use it', () => {
    const spec = buildOpenApi() as { paths: Record<string, Record<string, { responses: Record<string, { 'x-error-codes'?: string[] }> }>> };
    for (const methods of Object.values(spec.paths)) {
      for (const operation of Object.values(methods)) {
        for (const [status, response] of Object.entries(operation.responses)) {
          for (const code of response['x-error-codes'] ?? []) expect(ERROR_STATUS[code as keyof typeof ERROR_STATUS]).toBe(Number(status));
        }
      }
    }
  });

  it('has no drift between the registry and committed artefacts', () => {
    expect(read('packages/contracts/generated/openapi.json')).toBe(JSON.stringify(buildOpenApi(), null, 2) + '\n');
    expect(read('packages/client/src/generated/operations.ts')).toBe(buildClientMetadata());
  });
});
