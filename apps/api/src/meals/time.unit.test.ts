import {describe,expect,it} from 'vitest';
import {londonTime,resolveLondonTime} from './time.ts';

describe('London projection keeps sub-minute precision out of the UTC offset',()=>{
 it.each([
  ['2026-10-23T12:42:56.574Z',60,'2026-10-23','13:42'],
  ['2026-12-23T12:42:56.574Z',0,'2026-12-23','12:42'],
  ['2026-10-25T00:30:59.999Z',60,'2026-10-25','01:30'],
  ['2026-10-25T01:30:59.999Z',0,'2026-10-25','01:30'],
  ['2026-06-30T23:59:59.999Z',60,'2026-07-01','00:59'],
 ] as const)('projects %s with offset %i', (instant,offset,localDate,localTime)=>{
  expect(londonTime(new Date(instant))).toEqual({instant,localDate,localTime,timeZone:'Europe/London',utcOffsetMinutes:offset});
 });
 it('still requires an explicit repeated-hour offset and rejects the missing spring hour',()=>{
  const repeated={localDate:'2026-10-25',localTime:'01:30',timeZone:'Europe/London' as const};
  expect(()=>resolveLondonTime(repeated)).toThrow(expect.objectContaining({code:'TIME_AMBIGUOUS'}));
  expect(resolveLondonTime({...repeated,utcOffsetMinutes:60}).instant).toBe('2026-10-25T00:30:00.000Z');
  expect(resolveLondonTime({...repeated,utcOffsetMinutes:0}).instant).toBe('2026-10-25T01:30:00.000Z');
  expect(()=>resolveLondonTime({localDate:'2026-03-29',localTime:'01:30',timeZone:'Europe/London'})).toThrow(expect.objectContaining({code:'TIME_NONEXISTENT'}));
 });
});
