import {describe,expect,it} from 'vitest';
import {editMentionDraft,replaceMentionSelection,messageMentionPayload,plainMentionDraft,removeSelectedMention,selectMention,type MentionCandidate} from './mentions.ts';
const first:MentionCandidate={kind:'user',userId:'11111111-1111-4111-8111-111111111111',displayName:'Maya Chen',avatarUrl:null};
const second:MentionCandidate={...first,userId:'22222222-2222-4222-8222-222222222222'};
const everyone:MentionCandidate={kind:'everyone',userId:null,displayName:'Everyone',avatarUrl:null};
describe('selected group mentions',()=>{
 it('never infers entities from typing, pasting or restoring names',()=>{
  for(const draft of [plainMentionDraft('@Maya Chen @everyone'),editMentionDraft(plainMentionDraft(),'@Maya Chen')])expect(messageMentionPayload(draft).mentions).toEqual([]);
 });
 it('binds identical names to the selected stable user id and keeps spaces',()=>{
  const draft=selectMention(plainMentionDraft('Hello @Ma'),6,9,second);
  expect(messageMentionPayload(draft)).toEqual({body:'Hello @Maya Chen ',mentions:[{kind:'user',userId:second.userId,start:6,end:16}]});
 });
 it('uses code-point offsets after emoji and preserves leading whitespace',()=>{
  const draft=selectMention(plainMentionDraft('  🍜 @'),4,5,first);
  expect(messageMentionPayload(draft)).toEqual({body:'  🍜 @Maya Chen ',mentions:[{kind:'user',userId:first.userId,start:4,end:14}]});
 });
 it('rejects everyone for ordinary members and emits the exact host marker',()=>{
  expect(()=>selectMention(plainMentionDraft(),0,0,everyone)).toThrow(/host/);
  expect(messageMentionPayload(selectMention(plainMentionDraft(),0,0,everyone,true))).toEqual({body:'@everyone ',mentions:[{kind:'everyone',start:0,end:9}]});
 });
 it('shifts untouched tokens for insertions before and keeps additions after them plain',()=>{
  const selected=selectMention(plainMentionDraft(),0,0,first);
  const prefixed=editMentionDraft(selected,'🍜 '+selected.body);
  const changed=editMentionDraft(prefixed,prefixed.body+'@everyone');
  expect(messageMentionPayload(changed).mentions).toEqual([{kind:'user',userId:first.userId,start:2,end:12}]);
 });
 it('treats a multi-span replacement as pasted text instead of recreating the enclosed mention',()=>{
  const selected=selectMention(plainMentionDraft(),0,0,first);
  expect(messageMentionPayload(editMentionDraft(selected,'Hi '+selected.body+'again')).mentions).toEqual([]);
 });
 it('drops an edited token entity while preserving the resulting text',()=>{
  const selected=selectMention(plainMentionDraft(),0,0,first);
  expect(messageMentionPayload(editMentionDraft(selected,'@Maya Chan '))).toEqual({body:'@Maya Chan ',mentions:[]});
  expect(messageMentionPayload(editMentionDraft(selected,'@Maya 🍜Chen ')).mentions).toEqual([]);
 });
 it('removes a selected token and adjusts later token positions',()=>{
  const a=selectMention(plainMentionDraft(),0,0,first),b=selectMention(a,11,11,second);
  expect(messageMentionPayload(removeSelectedMention(b,0))).toEqual({body:' @Maya Chen ',mentions:[{kind:'user',userId:second.userId,start:1,end:11}]});
 });
 it('drops the entity for an explicit paste replacement even when the pasted text is identical',()=>{
  const selected=selectMention(plainMentionDraft(),0,0,first);
  expect(messageMentionPayload(replaceMentionSelection(selected,0,10,'@Maya Chen')).mentions).toEqual([]);
 });
 it('enforces the 100 entity limit independently of body length',()=>{
  let draft=plainMentionDraft();
  for(let i=0;i<100;i++){const end=Array.from(draft.body).length;draft=selectMention(draft,end,end,{...first,displayName:'A'});}
  const end=Array.from(draft.body).length;
  expect(()=>selectMention(draft,end,end,{...first,displayName:'A'})).toThrow(/100/);
  expect(draft.mentions).toHaveLength(100);
 });
 it('keeps the same body and entity payload for an unchanged retry',()=>{
  const selected=selectMention(plainMentionDraft(),0,0,first);
  expect(messageMentionPayload(editMentionDraft(selected,selected.body))).toEqual(messageMentionPayload(selected));
 });
 it('rejects invalid ranges and additions beyond the body limit without mutating the draft',()=>{
  const draft=plainMentionDraft('x'.repeat(2000));
  expect(()=>selectMention(draft,-1,0,first)).toThrow(/selection/);
  expect(()=>selectMention(draft,2000,2000,first)).toThrow(/2,000/);
  expect(draft.body).toHaveLength(2000);expect(draft.mentions).toEqual([]);
 });
});
