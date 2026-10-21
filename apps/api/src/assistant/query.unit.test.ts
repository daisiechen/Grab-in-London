import {describe,expect,it} from 'vitest';
import {applyPlan,londonDates,validatePlan} from './query.ts';
const now=new Date('2026-10-21T12:00:00Z');
const plan=(patches:unknown[],intent='SEARCH')=>({intent,patches,mealIds:[]});
const patch=(field:string,value:unknown,source:string,op='SET')=>({field,value,source,op});
describe('query provenance and server interpretation',()=>{
 it('parses London Friday, next natural-week Friday, tonight and Sunday remainder',()=>{
  expect(londonDates('周五',now)).toEqual({dates:['2026-10-23'],tonight:false});
  expect(londonDates('next Friday',now)).toEqual({dates:['2026-10-30'],tonight:false});
  expect(londonDates('今晚',now)).toEqual({dates:['2026-10-21'],tonight:true});
  expect(londonDates('weekend',new Date('2026-10-25T13:00:00Z'))).toEqual({dates:['2026-10-25'],tonight:false});
  expect(londonDates('2026-02-30',now)).toBeNull();
 });
 it('accepts explicit Friday Soho £35 4 people, deriving date/money on the server',()=>{
  const input='Friday Soho £35 4 people';
  const p=validatePlan(plan([patch('dates',['malicious-date'],'Friday'),patch('areas',['soho'],'Soho'),patch('budgetMaxPence',3500,'£35'),patch('tableSizes',[4],'4 people')]),input);
  const q=applyPlan(p,input,{}, {hard:{},cleared:[]},['soho'],now);
  expect(q.hard).toEqual({dates:['2026-10-23'],areas:['soho'],budgetMaxPence:3500,tableSizes:[4]});
 });
 it('preserves applied hard fields and suppresses both old hard and soft with explicit CLEAR',()=>{
  const input='no budget limit';const p=validatePlan(plan([patch('budgetMaxPence',null,input,'CLEAR')]),input);
  const q=applyPlan(p,input,{areas:['soho'],budgetMaxPence:2000},{hard:{budgetMaxPence:3500},cleared:[]},['soho'],now);
  expect(q.hard).toEqual({areas:['soho']});expect(q.conditions.cleared).toEqual(['budgetMaxPence']);
 });
 it('rejects injection fields, invented provenance, mismatched budget and duplicate fields',()=>{
  expect(()=>validatePlan({...plan([]),tool:'sendMessage'},'hello')).toThrow('AI_CONFLICT');
  expect(()=>validatePlan(plan([patch('budgetMaxPence',3500,'not present')]),'hello')).toThrow('AI_CONFLICT');
  const p=validatePlan(plan([patch('budgetMaxPence',3500,'£45')]),'£45');
  expect(()=>applyPlan(p,'£45',{}, {hard:{},cleared:[]},[],now)).toThrow('AI_CONFLICT');
  expect(()=>validatePlan(plan([patch('dates',[],'Friday'),patch('dates',[],'Friday')]),'Friday')).toThrow('AI_CONFLICT');
 });
 it('asks about Spanish without silently converting it into cuisine or language',()=>{
  const p=validatePlan(plan([]),'Spanish please');expect(applyPlan(p,'Spanish please',{}, {hard:{},cleared:[]},[],now).clarification).toBe(true);
 });
});


describe('cannot silently relax an explicit condition',()=>{
 it('rejects a CLEAR quote that does not identify the cleared field',()=>{
  const p=validatePlan(plan([patch('budgetMaxPence',null,'any date','CLEAR')]),'any date');
  expect(()=>applyPlan(p,'any date',{}, {hard:{budgetMaxPence:3500},cleared:[]},[],now)).toThrow('AI_CONFLICT');
 });
 it('asks when recognized explicit budget/date/area or cheapness was omitted from the parse',()=>{
  for(const input of ['Friday please','£35 please','Soho please','something cheaper']){
   const p=validatePlan(plan([]),input);expect(applyPlan(p,input,{}, {hard:{},cleared:[]},['soho'],now).clarification).toBe(true);
  }
 });
});
