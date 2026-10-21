// `node src/generate.ts` writes generated artefacts; `--check` fails on drift (used by core:check).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildClientMetadata, buildOpenApi } from './openapi.ts';

const root = join(import.meta.dirname, '../../..');
export const ARTEFACTS: Array<[string, () => string]> = [
  ['packages/contracts/generated/openapi.json', () => JSON.stringify(buildOpenApi(), null, 2) + '\n'],
  ['packages/client/src/generated/operations.ts', buildClientMetadata],
];

if (import.meta.main) {
  const check = process.argv.includes('--check');
  let drift = false;
  for (const [relative, build] of ARTEFACTS) {
    const path = join(root, relative);
    const next = build();
    let current = '';
    try { current = readFileSync(path, 'utf8'); } catch { /* missing counts as drift */ }
    if (current === next) continue;
    if (check) {
      console.error(`Generated artefact out of date: ${relative} (run pnpm --filter @fancy/contracts generate)`);
      drift = true;
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, next);
    }
  }
  if (drift) process.exit(1);
}
