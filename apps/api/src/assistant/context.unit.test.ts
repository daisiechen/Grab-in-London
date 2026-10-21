import {describe,it,expect,vi} from 'vitest';
import {emptyPreferences} from '../../../../packages/assistant/src/index.ts';
import {rankCandidates,filterPublicCandidates,type Candidate} from './context.ts';
const candidate=(id:string,budget:number):Candidate=>({id,version:'1',title:'Synthetic meal',description:'Public fixture meal description',venueRef:`venue-${id}`,startsAt:'2026-10-25T19:00:00Z',budgetMaxPence:budget,capacity:4,area:'soho',languages:['en'],mood:'EASY_CONVERSATION',dietaryCodes:[]});
describe('AI hard/soft separation',()=>{
 it('keeps expensive meals for soft budget while explicit budget excludes them',()=>{
  const data=[candidate('b',4500),candidate('a',3000)];const prefs={...emptyPreferences(),budgetMaxPence:3500};
  expect(rankCandidates(data,{},prefs).map(x=>x.id)).toEqual(['a','b']);
  expect(rankCandidates(data,{budgetMaxPence:3500},prefs).map(x=>x.id)).toEqual(['a']);
 });
 it('CLEAR suppresses both old hard and saved soft for that field without relaxing other fields',()=>{
  const prefs={...emptyPreferences(),budgetMaxPence:3500};
  expect(rankCandidates([candidate('a',4500),candidate('b',3000)],{budgetMaxPence:3500,areas:['soho']},prefs,['budgetMaxPence']).map(x=>x.id)).toEqual(['a','b']);
  expect(rankCandidates([candidate('a',4500)],{budgetMaxPence:3500,areas:['different']},prefs,['budgetMaxPence'])).toEqual([]);
 });
});
describe('all current Discover hard filters are retained',()=>{
 it('filters lunch/dinner by London time across BST/GMT instead of UTC hour',()=>{
  const a={...candidate('a',3000),startsAt:'2026-10-24T15:00:00Z'}; // 16:00 BST
  const b={...candidate('b',3000),startsAt:'2026-10-25T15:00:00Z'}; // 15:00 GMT
  expect(rankCandidates([a,b],{timeOfDay:'dinner'},emptyPreferences()).map(c=>c.id)).toEqual(['a']);
  expect(rankCandidates([a,b],{timeOfDay:'lunch'},emptyPreferences()).map(c=>c.id)).toEqual(['b']);
 });
 it('matches title or description without provider, preserving candidates as public projections',async()=>{
  const a=candidate('a',3000),b={...candidate('b',3000),description:'Public dumpling supper'};
  expect(await filterPublicCandidates([a],{keyword:'SYNTHETIC'})).toEqual([a]);
  expect(await filterPublicCandidates([b],{keyword:'dumpling'})).toEqual([b]);
 });
 it('uses current public venue name and bounds with request-local lookup deduplication, without mutating candidates',async()=>{
  const a=candidate('a',3000),b={...candidate('b',3000),venueRef:a.venueRef};
  const lookup=vi.fn(async()=>({name:'Provider keyword restaurant',location:{lat:51.5,lng:-.1}}));
  const snapshot=JSON.stringify([a,b]);
  expect(await filterPublicCandidates([a,b],{keyword:'keyword',bounds:{north:52,south:51,east:0,west:-1}},lookup)).toEqual([a,b]);
  expect(lookup).toHaveBeenCalledTimes(1);expect(JSON.stringify([a,b])).toBe(snapshot);expect(snapshot).not.toContain('location');
  expect(await filterPublicCandidates([a],{bounds:{north:50,south:49,east:0,west:-1}},lookup)).toEqual([]);
 });
 it('supports anti-meridian bounds and rejects reversed/invalid latitude bounds',async()=>{
  const a=candidate('a',3000),bounds={north:20,south:-20,west:170,east:-170};
  expect(await filterPublicCandidates([a],{bounds},async()=>({name:'Pacific',location:{lat:0,lng:179}}))).toEqual([a]);
  expect(await filterPublicCandidates([a],{bounds},async()=>({name:'Atlantic',location:{lat:0,lng:0}}))).toEqual([]);
  await expect(filterPublicCandidates([a],{bounds:{north:0,south:10,east:0,west:0}})).rejects.toThrow('AI_CONFLICT');
 });
 it('fails closed for missing/failed provider or invalid geometry rather than dropping unknown filters',async()=>{
  const a=candidate('a',3000),bounds={north:52,south:51,east:0,west:-1};
  await expect(filterPublicCandidates([a],{bounds})).rejects.toThrow('AI_UNAVAILABLE');
  await expect(filterPublicCandidates([a],{keyword:'restaurant'})).rejects.toThrow('AI_UNAVAILABLE');
  await expect(filterPublicCandidates([a],{bounds},async()=>{throw Error('provider unavailable');})).rejects.toThrow('AI_UNAVAILABLE');
  await expect(filterPublicCandidates([a],{bounds},async()=>({name:'Bad geometry',location:{lat:NaN,lng:0}}))).rejects.toThrow('AI_UNAVAILABLE');
 });
});
