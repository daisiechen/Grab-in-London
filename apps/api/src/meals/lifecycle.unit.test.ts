import { describe,it,expect } from 'vitest';
import { rosterAt,projectLifecycle,type SeatEvent } from './lifecycle.ts';
import {resolveLondonTime} from './time.ts';
const date=(s:string)=>new Date(s);
describe('meal pure lifecycle',()=>{
 it('excludes confirmation and exit at the exact boundary; reconstructs earlier membership after later exit',()=>{
 const at=date('2026-10-21T12:00Z');
 const events:SeatEvent[]=[{userId:'host',type:'HOST_CONFIRMED',effectiveAt:date('2026-10-20T12:00Z'),seq:1n},{userId:'guest',type:'GUEST_CONFIRMED',effectiveAt:date('2026-10-21T11:00Z'),seq:2n},{userId:'guest',type:'LEFT',effectiveAt:date('2026-10-21T13:00Z'),seq:3n},{userId:'equal',type:'GUEST_CONFIRMED',effectiveAt:at,seq:4n}];
 expect(rosterAt(events,at)).toEqual(['guest','host']);
 expect(rosterAt(events,date('2026-10-21T13:00Z'))).toEqual(['equal','host']);
 });
 it('projects late cancellation at cutoff and never completes a cancellation',()=>{
 const meal={status:'OPEN' as const,cancel_reason:null,closes_at:date('2026-10-21T12:00Z'),scheduled_end_at:date('2026-10-21T15:00Z'),minimum:2};
 expect(projectLifecycle(meal,[],date('2026-10-22T00:00Z'))).toEqual({status:'CANCELLED',cancelReason:'insufficient'});
 });
});
describe('P03 London wall clock',()=>{
 it('rejects nonexistent spring time and demands an autumn offset',()=>{
 expect(()=>resolveLondonTime({localDate:'2027-03-28',localTime:'01:30',timeZone:'Europe/London'})).toThrow(expect.objectContaining({code:'TIME_NONEXISTENT'}));
 expect(()=>resolveLondonTime({localDate:'2026-10-25',localTime:'01:30',timeZone:'Europe/London'})).toThrow(expect.objectContaining({code:'TIME_AMBIGUOUS'}));
 expect(resolveLondonTime({localDate:'2026-10-25',localTime:'01:30',timeZone:'Europe/London',utcOffsetMinutes:0}).instant).toBe('2026-10-25T01:30:00.000Z');
 expect(resolveLondonTime({localDate:'2026-10-25',localTime:'01:30',timeZone:'Europe/London',utcOffsetMinutes:60}).instant).toBe('2026-10-25T00:30:00.000Z');
 });
 it('rejects invalid dates and wrong summer offset',()=>{
 expect(()=>resolveLondonTime({localDate:'2027-02-30',localTime:'12:00',timeZone:'Europe/London'})).toThrow();
 expect(()=>resolveLondonTime({localDate:'2027-07-01',localTime:'12:00',timeZone:'Europe/London',utcOffsetMinutes:0})).toThrow(expect.objectContaining({code:'INVALID_OFFSET'}));
 });
});
