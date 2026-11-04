// Fails when a likely credential appears in production workspace sources.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

// App Store review sign-in (app-store-submission §7): neither the code nor its stored hash may be
// committed anywhere, documentation included. Tests compute hashes at run time.
const REVIEW_PATTERNS = [
  ['App Store review code hash', /\bscrypt:\d{5,6}:\d{1,2}:\d{1,2}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/],
  ['App Store review code', /\bREVIEW_ACCOUNT_CODE(?:_HASH)?\s*[:=]\s*['"]?(?:[0-9]{6}\b|scrypt:)/],
];
const PATTERNS = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['OpenAI key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ['Slack token', /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/],
  ['Ethan moderation token', /\bETHAN_MODERATION_TOKEN\s*[:=]\s*['"]?[A-Za-z0-9_\-.~+/]{16,}/],
  ['assigned secret', /\b(?:client_secret|api_key|apikey|secret_key|password)\s*[:=]\s*['"][^'"\s]{12,}['"]/i],
  ...REVIEW_PATTERNS,
];
const SCANNED = ['apps', 'packages', 'infra'];
const REVIEW_SCANNED = ['docs', 'scripts', 'tests', 'tasks'];
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
  const walk = (dir, patterns) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (SKIP.has(name)) continue;
      const path = join(dir, name);
      if (ignoredPrivateEnvironment(root, path, name)) continue;
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path, patterns);
      else if (stat.size < 1_000_000) {
        const text = readFileSync(path, 'utf8');
        for (const [label, pattern] of patterns) {
          if (pattern.test(text)) findings.push(`${relative(root, path)}: ${label}`);
        }
      }
    }
  };
  for (const dir of SCANNED) walk(join(root, dir), PATTERNS);
  for (const dir of REVIEW_SCANNED) walk(join(root, dir), REVIEW_PATTERNS);
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
