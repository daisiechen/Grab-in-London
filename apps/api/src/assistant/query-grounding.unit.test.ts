import {expect,it} from 'vitest';
import {applyPlan,validatePlan} from './query.ts';
function apply(input:string,field:string,value:unknown,source:string){return applyPlan(validatePlan({intent:'SEARCH',patches:[{field,op:'SET',value,source}],mealIds:[]},input),input,{}, {hard:{},cleared:[]},['soho'],new Date('2026-11-06T12:00:00Z'));}
it.each([
 ['找明天20镑以内的午餐。','budgetMaxPence',2000,'20镑'],
 ['找Soho一镑以内的二人桌。','budgetMaxPence',100,'一镑'],
 ['记住我喜欢Soho、预算20镑。','budgetMaxPence',2000,'20镑'],
 ['Show Soho tables for two under £1.','tableSizes',[2],'two'],
 ['找Soho一镑以内的二人桌。','tableSizes',[2],'二人'],
] as const)('grounds exact supplied number: %s',(input,field,value,source)=>expect(apply(input,field,value,source).hard).toHaveProperty(field,value));
it.each([
 ['two friends like food','tableSizes',[2],'two'],['two friends wait at a table','tableSizes',[2],'two'],['tables for twenty two','tableSizes',[2],'two'],
 ['tables for two or three','tableSizes',[2],'two'],['二十人桌','tableSizes',[2],'二人'],
 ['找七人桌','tableSizes',[7],'七人'],['找二人桌','tableSizes',[3],'二人'],
 ['预算二十一镑','budgetMaxPence',100,'一镑'],['预算20镑','budgetMaxPence',100,'20镑'],
 ['预算-20镑','budgetMaxPence',2000,'-20镑'],['预算20.999镑','budgetMaxPence',99900,'999镑'],
 ['预算20镑','budgetMaxPence',2000,'£20'],
] as const)('rejects invented/ambiguous/invalid number: %s',(input,field,value,source)=>expect(()=>apply(input,field,value,source)).toThrow('AI_CONFLICT'));
it.each([['tables for three',[3],'three'],['六人桌',[6],'六人'],['tables for 4 people',[4],'4 people']] as const)('retains bounded explicit sizes %s',(input,value,source)=>expect(apply(input,'tableSizes',value,source).hard.tableSizes).toEqual(value));
