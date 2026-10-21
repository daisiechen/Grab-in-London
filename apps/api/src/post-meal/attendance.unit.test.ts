import {describe,expect,it} from 'vitest';
import {assertWindow,POST_MEAL_WINDOW_MS,projectAttendance} from './attendance.ts';
describe('post-meal attendance projection and continuous reporting window',()=>{
 it('keeps unknown distinct from absent and takes the latest of each source before applying explicit support override',()=>{
  expect(projectAttendance('u',[])).toMatchObject({value:'unknown',source:null,version:'0'});
  expect(projectAttendance('u',[{source:'HOST',value:'absent',version:'3'},{source:'SELF',value:'present',version:'1'}])).toMatchObject({value:'present',source:'SELF',version:'3'});
  expect(projectAttendance('u',[{source:'SELF',value:'present',version:'1'},{source:'SUPPORT',value:'absent',version:'4'},{source:'HOST',value:'present',version:'5'}])).toMatchObject({value:'absent',source:'SUPPORT',selfValue:'present',hostValue:'present',version:'5'});
 });
 it('opens exactly at end, closes exactly at end plus seven 24-hour days and never opens for a cancelled meal',()=>{
  const end=new Date('2026-10-24T20:00:00Z');const meal={status:'COMPLETED' as const,scheduled_end_at:end};
  expect(()=>assertWindow(meal,end)).not.toThrow();
  expect(()=>assertWindow(meal,new Date(end.getTime()+POST_MEAL_WINDOW_MS-1))).not.toThrow();
  expect(()=>assertWindow(meal,new Date(end.getTime()+POST_MEAL_WINDOW_MS))).toThrow();
  expect(()=>assertWindow(meal,new Date(end.getTime()-1))).toThrow();
  expect(()=>assertWindow({...meal,status:'CANCELLED'},end)).toThrow();
 });
});
