import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {AreaPolygons} from './areas.ts';

/**
 * The shipped verified London area dataset (apps/api/data/london-areas.v1.json): ONS LSOA 2021 boundaries
 * (Open Government Licence v3.0) grouped into named areas (House of Commons Library MSOA Names, Open
 * Parliament Licence v3.0) for the central launch zone. Rebuilt by scripts/build-london-areas.mjs; provenance,
 * attribution and known approximations in docs/engineering/london-areas.zh-CN.md. Validation happens where it
 * is used (compileAreaPolygons), so a damaged file stops the API at start-up instead of guessing areas.
 */
export const LONDON_AREAS_FILE=join(import.meta.dirname,'../../data/london-areas.v1.json');
export function loadLondonAreas(file=LONDON_AREAS_FILE):AreaPolygons{return JSON.parse(readFileSync(file,'utf8')) as AreaPolygons;}
