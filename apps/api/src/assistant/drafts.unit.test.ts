import {describe,expect,it} from 'vitest';
import {createDraft,validateDraftText} from './drafts.ts';
describe('text candidate validation',()=>{
 it('keeps application within original 20–300 form limit and create fields do not include attestations',()=>{
  const d=createDraft('APPLICATION','00000000-0000-4000-8000-000000000001','1','2',{text:'Would love to join your table and meet everyone.'},'Please write a friendly introduction');
  expect(d.text?.length).toBeGreaterThanOrEqual(20);expect(d.editorVersion).toBe('2');
  expect(()=>createDraft('APPLICATION',d.targetId,'1','2',{text:'x'.repeat(301)},'hello')).toThrow('AI_CONFLICT');
  expect(()=>createDraft('CREATE',null,null,'1',{title:'A meal together',description:'A relaxed meal to meet new people.',bookingDeclarationConfirmed:true},'meal')).toThrow('AI_CONFLICT');
 });
 it('rejects fabricated identity, business completion, unknown links and HTML',()=>{
  for(const text of ['I work at BigCorp and I am the host.','Your table is booked and paid.','Visit https://example.invalid','<b>Hello everyone</b>'])expect(()=>validateDraftText(text,'Please help',1,1000)).toThrow('AI_CONFLICT');
 });
 it('allows an explicitly user-supplied biography claim rather than inferring one',()=>{
  expect(validateDraftText('I study design. It would be nice to join.','I study design',20,300)).toContain('I study design');
 });
});
