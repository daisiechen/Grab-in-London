import { describe,expect,it } from 'vitest';
import { boundedCsv,csvCell } from './exports.ts';
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
