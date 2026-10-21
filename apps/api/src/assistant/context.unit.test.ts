import {describe,it,expect} from 'vitest';
import {emptyPreferences} from '../../../../packages/assistant/src/index.ts';
import {rankCandidates,type Candidate} from './context.ts';
const candidate=(id:string,budget:number):Candidate=>({id,version:'1',title:'Synthetic meal',startsAt:'2026-10-25T19:00:00Z',budgetMaxPence:budget,capacity:4,area:'soho',languages:['en'],mood:'EASY_CONVERSATION',dietaryCodes:[]});
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
