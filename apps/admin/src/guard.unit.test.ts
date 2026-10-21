import { describe, expect, it } from 'vitest';

// Production sources only (tests and test helpers excluded), read raw through Vite.
const raw = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.unit.test.{ts,tsx}', '!./test/**'], { query: '?raw', import: 'default', eager: true });
/** Source with string literals blanked, so identifier checks ignore UI copy. */
const code = (text: string) => text.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''");
const sources = Object.entries(raw).map(([path, text]) => ({ path: path.slice(2), text, code: code(text) }));

describe('no fixtures or client-side business computation in production code', () => {
  it('scans a non-empty production source set', () => {
    expect(sources.map((s) => s.path)).toEqual(expect.arrayContaining(['App.tsx', 'main.tsx', 'api/admin-api.ts']));
  });

  it('detects identifiers but ignores UI copy', () => {
    expect(/\bSNAPSHOT\b/.test(code("import { SNAPSHOT } from './analytics';"))).toBe(true);
    expect(/\bSNAPSHOT\b/.test(code("t('全量快照', 'FULL SNAPSHOT · X')"))).toBe(false);
  });

  it.each([
    ['prototype fixtures', /fixtures?\b/i],
    ['the prototype SNAPSHOT constant', /\bSNAPSHOT\b/],
    ['prototype analytics/metric formulas', /from ['"].*\/(analytics|checks)(\.ts)?['"]/],
    ['imports from the read-only prototype', /from ['"](\.\.\/)+(admin|demo|shared)\//],
    ['browser storage of business data', /\b(localStorage|sessionStorage|indexedDB)\b/],
    ['review/demo scenario switching', /review=1|reviewMode|setSampleData/],
  ])('contains no %s', (label, pattern) => {
    // The SNAPSHOT rule checks identifiers only (upper-case UI copy such as 'FULL SNAPSHOT' is allowed).
    const field = label.includes('SNAPSHOT') ? 'code' : 'text';
    expect(sources.filter((s) => pattern.test(s[field])).map((s) => s.path)).toEqual([]);
  });
});
