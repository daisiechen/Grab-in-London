import { describe,expect,it } from 'vitest';
import { boundedCsv,csvCell,exportProvenance,summaryMetricRow } from './exports.ts';
describe('CSV safety and resource bounds',()=>{
  it('quotes delimiters/newlines and suppresses formula and control-prefixed strings',()=>{
    expect(csvCell('a,"b"\nnext')).toBe('"a,""b""\nnext"');
    for(const value of ['=HYPERLINK("evil")',' +SUM(A1:A2)','-1+1','@cmd','\t=1+1','\rcommand'])expect(csvCell(value)).toBe('"\''+value.replaceAll('"','""')+'"');
    expect(csvCell(0)).toBe('"0"');expect(csvCell(null)).toBe('""');
  });
  it('rejects row and byte overflow instead of silently truncating output',()=>{
    expect(()=>boundedCsv([['a'],['b']],{rows:1,bytes:100})).toThrow('row limit');
    expect(()=>boundedCsv([['日本語']],{rows:5,bytes:4})).toThrow('file limit');
    expect(boundedCsv([['a','b']],{rows:1,bytes:9}).toString()).toBe('"a","b"\r\n');
  });
});

describe('server-owned CSV provenance',()=>{
 const real={AUTH_ADAPTER:'auth0',PLACES_ADAPTER:'google',MAIL_ADAPTER:'provider',AI_PROVIDER:'deepseek'} as const;
 it('labels real production separately from non-production without exposing configuration',()=>{
  expect(exportProvenance({environment:'production',adapters:real})).toEqual({environment:'production',dataSource:'production'});
  for(const environment of ['staging','development','test'] as const)expect(exportProvenance({environment,adapters:real})).toEqual({environment,dataSource:'non_production'});
 });
 it('marks every test-only adapter independently as synthetic',()=>{
  for(const adapters of [{...real,AUTH_ADAPTER:'test'},{...real,PLACES_ADAPTER:'fixture'},{...real,MAIL_ADAPTER:'outbox_test'},{...real,AI_PROVIDER:'mock'}] as const){
   for(const environment of ['development','test'] as const)expect(exportProvenance({environment,adapters})).toEqual({environment,dataSource:'synthetic_fixture'});
  }
 });
 it('disabled AI does not mislabel otherwise real data as synthetic',()=>{
  expect(exportProvenance({environment:'production',adapters:{...real,AI_PROVIDER:'disabled'}})).toEqual({environment:'production',dataSource:'production'});
 });
});

describe('partial summary metric status',()=>{
 it('distinguishes a missing source, known empty source, zero denominator and actual zero',()=>{
  expect(summaryMetricRow('missing',null)).toEqual(['missing','','','','unavailable']);
  expect(summaryMetricRow('empty',null,true)).toEqual(['empty','','','','no_data']);
  expect(summaryMetricRow('ratio',{numerator:0,denominator:0},true)).toEqual(['ratio','',0,0,'no_denominator']);
  expect(summaryMetricRow('zero',0)).toEqual(['zero',0,'','','available']);
  expect(summaryMetricRow('ratio',{numerator:1,denominator:2},true)).toEqual(['ratio',0.5,1,2,'available']);
 });
});
