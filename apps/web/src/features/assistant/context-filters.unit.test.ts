import {describe,expect,it} from 'vitest';
import {routeContext} from './model.ts';
describe('assistant applied discovery filters',()=>{
 it('preserves map, keyword, time and other hard filters together',()=>{
  const context=routeContext('/discover','?north=51.6&south=51.4&east=0&west=-0.3&keyword=Ramen&timeOfDay=dinner&budgetMaxPence=3500&languages=en');
  expect(context.appliedFilters).toMatchObject({bounds:{north:51.6,south:51.4,east:0,west:-0.3},keyword:'Ramen',timeOfDay:'dinner',budgetMaxPence:3500,languages:['en']});
 });
 it('does not attach discovery filters from another page or invent an any time restriction',()=>{
  expect(routeContext('/create','?keyword=Ramen').appliedFilters).toBeUndefined();
  expect(routeContext('/discover','').appliedFilters).not.toHaveProperty('timeOfDay');
 });
});
