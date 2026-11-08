import {statSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {LONDON_AREA_NAMES} from '../../../../packages/client/src/london-area-names.ts';
import {compileAreaPolygons} from './areas.ts';
import {LONDON_AREAS_FILE,loadLondonAreas} from './london-areas.ts';

const dataset=loadLondonAreas();
type Geometry=(typeof dataset.areas)[number]['geometry'];
const rings=(g:Geometry)=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).flat();

describe('shipped London area dataset',()=>{
 it('is a verified dataset that compiles for production and staging within the API limits',()=>{
  expect(dataset.kind).toBe('verified');
  expect(dataset.version).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/);
  expect(dataset.revision).toBe(1);
  for(const environment of ['production','staging','development','test'] as const)expect(()=>compileAreaPolygons(dataset,environment)).not.toThrow();
  expect(dataset.areas.length).toBeLessThanOrEqual(256);
  expect(dataset.areas.reduce((n,a)=>n+rings(a.geometry).reduce((m,r)=>m+r.length,0),0)).toBeLessThanOrEqual(10_000);
  expect(statSync(LONDON_AREAS_FILE).size).toBeLessThan(1_000_000);
 });

 it('carries the attribution its licences require',()=>{
  const {attribution}=dataset as typeof dataset&{attribution:string[]};
  expect(attribution.join('\n')).toContain('Office for National Statistics licensed under the Open Government Licence v3.0');
  expect(attribution.join('\n')).toContain('Contains OS data © Crown copyright and database right');
  expect(attribution.join('\n')).toContain('House of Commons Library MSOA Names');
  expect(attribution.join('\n')).toContain('Open Parliament Licence v3.0');
 });

 it('maps landmarks to the codes the illustrated map pins, and leaves places outside the launch zone unknown',()=>{
  const map=compileAreaPolygons(dataset,'production');
  const at=(lat:number,lng:number)=>map({lat,lng}).areaCode;
  expect(at(51.5155,-0.1320)).toBe('soho'); // Soho Square
  expect(at(51.5130,-0.1310)).toBe('soho'); // Old Compton Street
  expect(at(51.5232,-0.1405)).toBe('fitzrovia'); // Fitzroy Square
  expect(at(51.5195,-0.1350)).toBe('fitzrovia'); // Charlotte Street
  expect(at(51.5117,-0.1229)).toBe('covent-garden'); // Covent Garden Piazza
  expect(at(51.5141,-0.1268)).toBe('covent-garden'); // Seven Dials (Camden)
  expect(at(51.5074,-0.1350)).toBe('st-jamess'); // St James's Square
  expect(at(51.5098,-0.1459)).toBe('mayfair'); // Berkeley Square
  expect(at(51.5246,-0.0786)).toBe('shoreditch');
  expect(at(51.5054,-0.0235)).toBe('canary-wharf');
  expect(map({lat:51.5155,lng:-0.1320})).toEqual({areaCode:'soho',areaVersion:dataset.version,areaRevision:1});
  expect(at(51.4700,-0.4543)).toBe('unknown'); // Heathrow, outside the zone
  expect(at(50.8200,-0.1400)).toBe('unknown'); // Brighton
 });

 it('names every area, and the client name map is generated from the same revision',()=>{
  const names=Object.fromEntries(dataset.areas.map(a=>[a.areaCode,a.name]));
  for(const [code,name] of Object.entries(names)){expect(name,code).toMatch(/\S/);expect(name,code).not.toContain("'");}
  expect(LONDON_AREA_NAMES).toEqual(names);
  expect(names).toMatchObject({soho:'Soho',fitzrovia:'Fitzrovia','covent-garden':'Covent Garden','st-jamess':'St James’s'});
 });
});
