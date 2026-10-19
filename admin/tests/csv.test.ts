import {test} from "node:test";
import assert from "node:assert/strict";
import {serializeCsv} from "../src/csv.ts";
test("CSV keeps quoting and prevents spreadsheet formula interpretation",()=>{
 const text=serializeCsv([["snapshot","S-1"],["=SUM(A1)","a\"b", "x,y", "line\nline"]]);
 assert.equal(text,'\uFEFF"snapshot","S-1"\r\n"\'=SUM(A1)","a""b","x,y","line\nline"');
});
