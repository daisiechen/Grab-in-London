#!/usr/bin/env node
// Rebuilds the verified London area dataset used by the API to map a restaurant's coordinates to an
// area code (apps/api/data/london-areas.v1.json), plus the client display-name map
// (packages/client/src/london-area-names.ts).
//
//   node scripts/build-london-areas.mjs [--cache <dir>] [--interval <metres>] [--check]
//
// Sources (both open licences that allow commercial use and redistribution with attribution):
// - ONS "Lower layer Super Output Areas (December 2021) Boundaries EW BGC", Open Government Licence v3.0,
//   read from a GitHub mirror pinned to one commit because the ONS portal is not reachable from every build
//   environment. Each file's SHA-256 is checked against the values below.
// - House of Commons Library MSOA Names 2.3, Open Parliament Licence v3.0.
//
// Method: every LSOA in the launch zone is grouped into its 2021 MSOA and named with the Commons Library
// name, except a hand-listed set of West End LSOAs that are grouped into the neighbourhoods the app's
// illustrated map pins (Soho, Fitzrovia, Covent Garden, St James's) and Mayfair. Groups are dissolved and
// simplified (25 m) with mapshaper on shared arcs, so neighbouring areas keep one common edge (no gaps or overlaps
// are introduced). The script fails if the result breaks the API limits (256 areas, 10,000 ring points).
// See docs/engineering/london-areas.zh-CN.md for provenance, licences, and known approximations.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');
const DATASET = path.join(REPO, 'apps/api/data/london-areas.v1.json');
const NAMES_TS = path.join(REPO, 'packages/client/src/london-area-names.ts');
const MAPSHAPER = 'mapshaper@0.7.71';

const VERSION = 'ons-lsoa21-hocl-msoa-names-central-v1';
const REVISION = 1;

const LSOA_COMMIT = 'e20a072d5fc0918437abaa3622be63f40b71d9dd';
const LSOA_URL = (lad) => `https://raw.githubusercontent.com/drkane/geo-lookups/${LSOA_COMMIT}/boundaries/lsoa/${lad}.geojson`;
const NAMES_URL = 'https://raw.githubusercontent.com/houseofcommonslibrary/houseofcommonslibrary.github.io/main/msoanames/MSOA-Names-2.3.csv';

/** Launch zone: the nine central inner-London boroughs (LAD 2021 code → name). */
const ZONE = {
  E09000001: 'City of London',
  E09000007: 'Camden',
  E09000012: 'Hackney',
  E09000019: 'Islington',
  E09000020: 'Kensington and Chelsea',
  E09000022: 'Lambeth',
  E09000028: 'Southwark',
  E09000030: 'Tower Hamlets',
  E09000033: 'Westminster',
};

/** SHA-256 of the inputs this dataset revision was built from. */
const SHA256 = {
  names: '87a409877889a9b750f713c240706191fb34fe326233405df9c7da1b64305b63',
  E09000001: 'd33fe1d43602cf438e8218504338c0551cd408ef0b7d01fe23faedf1b2e460ae',
  E09000007: '25b8e2ac4f3c75a7c41b5632d14bb9ec3e95a9ecbb13dd33bf1c51f9aaed3c2b',
  E09000012: '2a68594ec2a5f4da503d351b2c1dbe1d006ada0d73437b2269bbd237f90727c1',
  E09000019: 'f3b9c021bd7448056565f5aa4fc6be052e5e038d82ead2217252a3b339fed48b',
  E09000020: 'b0b2a5aedbe3ad052bf2949a106ffed102795d0138f988ff90d175c765378c2b',
  E09000022: 'e991d60855d2ed37f0a34565c2eb744369b10ca490c3224812fa437673b02fd7',
  E09000028: '1cfe0c24b31957ee205c3e8aa7a2b81836143f832a2ddf75a471a7f929c36fb9',
  E09000030: '9af7ef74a0c4cfd4349c84705cc351055b45bc1b63fbdc068eaa5e15f00c09a8',
  E09000033: 'ac80017ffd9ff3baf875d89d10361184e5760d0a5fda32367f23ee60d3ded051',
};

/**
 * West End neighbourhoods built from whole LSOAs (LSOA21NM → area). LSOA boundaries follow streets but not
 * neighbourhood edges exactly; the approximations are listed in the provenance document.
 */
const NEIGHBOURHOODS = {
  soho: { name: 'Soho', lsoas: ['Westminster 013B', 'Westminster 013G'] },
  fitzrovia: { name: 'Fitzrovia', lsoas: ['Westminster 013A', 'Westminster 013D', 'Camden 026A', 'Camden 026B'] },
  'covent-garden': { name: 'Covent Garden', lsoas: ['Westminster 018A', 'Westminster 018B', 'Camden 028C', 'Camden 028D'] },
  'st-jamess': { name: 'St James’s', lsoas: ['Westminster 018C'] },
  mayfair: { name: 'Mayfair', lsoas: ['Westminster 018D', 'Westminster 011E'] },
};
/** Names for what is left of an MSOA after the neighbourhoods above take some of its LSOAs. */
const REMAINDER_NAMES = {
  'Westminster 011': 'Marylebone', // "Marylebone & Park Lane" without the Park Lane / Mayfair LSOA
  'Camden 026': 'Bloomsbury West', // "Fitzrovia East & Bloomsbury West" without the Fitzrovia LSOAs
  'Camden 028': 'Holborn & Bloomsbury South', // "Holborn, St Giles & Bloomsbury South" without Seven Dials / St Giles
};

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const CHECK = args.includes('--check');
const INTERVAL = Number(opt('--interval', '25'));
const cache = path.resolve(opt('--cache', fs.mkdtempSync(path.join(os.tmpdir(), 'london-areas-'))));
fs.mkdirSync(cache, { recursive: true });

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
async function download(url, file, key) {
  const target = path.join(cache, file);
  if (!fs.existsSync(target)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  }
  const buf = fs.readFileSync(target);
  const digest = sha(buf);
  if (SHA256[key] !== digest) throw new Error(`${file}: SHA-256 ${digest} does not match the pinned ${SHA256[key]}`);
  return buf;
}

/** RFC 4180 enough for the Commons Library file (quoted fields with commas, no embedded newlines). */
function parseCsv(text) {
  const rows = [];
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line) continue;
    const cells = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') quoted = false; else cur += c; }
      else if (c === '"') quoted = true;
      else if (c === ',') { cells.push(cur); cur = ''; }
      else cur += c;
    }
    cells.push(cur);
    rows.push(cells);
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/** Display name: typographic apostrophe. Code: lower-case ASCII slug, apostrophes dropped, “&” and punctuation as separators. */
const displayName = (name) => name.replace(/'/g, '’');
const slug = (name) => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const namesCsv = parseCsv((await download(NAMES_URL, 'MSOA-Names-2.3.csv', 'names')).toString('utf8'));
const msoaName = new Map(namesCsv.map((r) => [r.msoa21nm, r.msoa21hclnm]));

const byLsoa = new Map(Object.entries(NEIGHBOURHOODS).flatMap(([code, n]) => n.lsoas.map((l) => [l, code])));
const features = [];
for (const lad of Object.keys(ZONE)) {
  const fc = JSON.parse((await download(LSOA_URL(lad), `lsoa-${lad}.geojson`, lad)).toString('utf8'));
  for (const f of fc.features) {
    const lsoa = f.properties.LSOA21NM, msoa = lsoa.slice(0, -1);
    let code = byLsoa.get(lsoa), name = code && NEIGHBOURHOODS[code].name;
    if (!code) {
      const hocl = REMAINDER_NAMES[msoa] ?? msoaName.get(msoa);
      if (!hocl) throw new Error(`${lsoa}: no Commons Library name for ${msoa}`);
      name = displayName(hocl);
      code = slug(hocl);
    }
    features.push({ type: 'Feature', properties: { code, name, msoa }, geometry: f.geometry });
    byLsoa.delete(lsoa);
  }
}
if (byLsoa.size) throw new Error(`Neighbourhood LSOAs not found: ${[...byLsoa.keys()].join(', ')}`);
// One code must come from exactly one MSOA (or one hand-listed neighbourhood).
const owner = new Map();
for (const f of features) {
  const key = NEIGHBOURHOODS[f.properties.code] ? f.properties.code : f.properties.msoa;
  if (owner.has(f.properties.code) && owner.get(f.properties.code) !== key) throw new Error(`Area code ${f.properties.code} is used by ${owner.get(f.properties.code)} and ${key}`);
  owner.set(f.properties.code, key);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'london-areas-work-'));
const input = path.join(work, 'lsoa.geojson'), output = path.join(work, 'areas.geojson');
fs.writeFileSync(input, JSON.stringify({ type: 'FeatureCollection', features }));
execFileSync('npx', ['--yes', MAPSHAPER, '-i', input, 'snap',
  '-dissolve', 'code', 'copy-fields=name',
  '-simplify', `interval=${INTERVAL}`, 'keep-shapes',
  '-clean',
  '-o', output, 'format=geojson', 'precision=0.000001'], { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, npm_config_ignore_scripts: 'true' } });
const dissolved = JSON.parse(fs.readFileSync(output, 'utf8'));
fs.rmSync(work, { recursive: true, force: true });

const round = (n) => Math.round(n * 1e6) / 1e6;
/** Rounds, drops consecutive duplicates and closes the ring. */
function cleanRing(ring) {
  const out = [];
  for (const [x, y] of ring) { const p = [round(x), round(y)]; const q = out.at(-1); if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p); }
  const a = out[0], b = out.at(-1);
  if (a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1]]);
  return out;
}
let points = 0;
const areas = dissolved.features.map((f) => {
  const g = f.geometry;
  const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((p) => p.map(cleanRing).filter((r) => r.length >= 4));
  for (const p of polys) for (const r of p) points += r.length;
  return {
    areaCode: f.properties.code,
    name: f.properties.name,
    geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys },
  };
}).sort((a, b) => (a.areaCode < b.areaCode ? -1 : 1));

for (const code of ['soho', 'fitzrovia', 'covent-garden', 'st-jamess']) if (!areas.some((a) => a.areaCode === code)) throw new Error(`Missing ${code}`);
if (areas.length > 256) throw new Error(`${areas.length} areas exceed the API limit of 256`);
if (points > 10_000) throw new Error(`${points} ring points exceed the API limit of 10,000; raise --interval`);

const dataset = {
  kind: 'verified',
  version: VERSION,
  revision: REVISION,
  attribution: [
    'Source: Office for National Statistics licensed under the Open Government Licence v3.0. Contains OS data © Crown copyright and database right 2021.',
    'Area names: House of Commons Library MSOA Names 2.3, licensed under the Open Parliament Licence v3.0.',
  ],
  source: {
    boundaries: 'ONS Lower layer Super Output Areas (December 2021) Boundaries EW BGC',
    boundariesMirror: LSOA_URL('<LAD21CD>'),
    names: NAMES_URL,
    zone: Object.values(ZONE),
    simplification: `mapshaper ${MAPSHAPER.split('@')[1]} dissolve + simplify interval=${INTERVAL}m (shared arcs, keep-shapes), 6 decimal places`,
  },
  areas,
};
const json = JSON.stringify(dataset) + '\n';
const names = `// Generated by scripts/build-london-areas.mjs from ${path.relative(REPO, DATASET)} (${VERSION} r${REVISION}). Do not edit.\n`
  + '// Area names: House of Commons Library MSOA Names (Open Parliament Licence v3.0) and the West End neighbourhoods listed in the build script.\n'
  + `export const LONDON_AREA_NAMES: Readonly<Record<string, string>> = {\n${areas.map((a) => `  ${JSON.stringify(a.areaCode)}: ${JSON.stringify(a.name)},`).join('\n')}\n};\n`;

if (CHECK) {
  const same = fs.readFileSync(DATASET, 'utf8') === json && fs.readFileSync(NAMES_TS, 'utf8') === names;
  if (!same) { console.error('Committed London area files differ from a fresh build.'); process.exit(1); }
} else {
  fs.mkdirSync(path.dirname(DATASET), { recursive: true });
  fs.writeFileSync(DATASET, json);
  fs.writeFileSync(NAMES_TS, names);
}
console.warn(`${areas.length} areas, ${points} ring points, ${(Buffer.byteLength(json) / 1024).toFixed(1)} KiB (cache ${cache})`);
