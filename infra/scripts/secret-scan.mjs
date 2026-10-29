// Fails when a likely credential appears in production workspace sources.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

const PATTERNS = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['OpenAI key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ['Slack token', /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/],
  ['Ethan moderation token', /\bETHAN_MODERATION_TOKEN\s*[:=]\s*['"]?[A-Za-z0-9_\-.~+/]{16,}/],
  ['assigned secret', /\b(?:client_secret|api_key|apikey|secret_key|password)\s*[:=]\s*['"][^'"\s]{12,}['"]/i],
];
const SCANNED = ['apps', 'packages', 'infra'];
const SKIP = new Set(['node_modules', 'dist', '.turbo', 'coverage']);

// Private runtime dotenv files are deliberately kept outside the public source tree.
// Never exempt a tracked file, a template, or anything on an inconclusive Git check.
function ignoredPrivateEnvironment(root, path, name) {
  if (name === '.env.example' || !(name === '.env' || name.startsWith('.env.'))) return false;
  const file = relative(root, path);
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '--', file], { cwd: root, stdio: 'ignore' });
  if (tracked.status !== 1) return false;
  return spawnSync('git', ['check-ignore', '--quiet', '--', file], { cwd: root, stdio: 'ignore' }).status === 0;
}

export function scan(root) {
  const findings = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (SKIP.has(name)) continue;
      const path = join(dir, name);
      if (ignoredPrivateEnvironment(root, path, name)) continue;
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (stat.size < 1_000_000) {
        const text = readFileSync(path, 'utf8');
        for (const [label, pattern] of PATTERNS) {
          if (pattern.test(text)) findings.push(`${relative(root, path)}: ${label}`);
        }
      }
    }
  };
  for (const dir of SCANNED) walk(join(root, dir));
  for (const file of ['.env.example']) {
    try {
      for (const line of readFileSync(join(root, file), 'utf8').split('\n')) {
        if (/^[A-Z_]+=.+/.test(line)) findings.push(`${file}: value present for ${line.split('=')[0]}`);
      }
    } catch { /* optional */ }
  }
  return findings;
}

if (import.meta.main) {
  const findings = scan(process.argv[2] ?? '.');
  if (findings.length) {
    console.error('Possible secrets found:\n' + findings.join('\n'));
    process.exit(1);
  }
}
