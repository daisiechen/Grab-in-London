import type {RequestOf,ResponseOf} from './types.ts';

type Mention = RequestOf<'sendGroupMessageV2'>['body']['mentions'][number];
export type MentionCandidate = ResponseOf<'mentionCandidates'>['data'][number];
export type SelectedMention = Mention & {label:string};
export interface MentionDraft {body:string;mentions:SelectedMention[]}

/** Restored/pasted text is always plain until a person explicitly selects a candidate. */
export const plainMentionDraft = (body=''):MentionDraft => ({body,mentions:[]});

function validMentions(draft:MentionDraft):SelectedMention[] {
 const points=Array.from(draft.body);
 let previousEnd=0;
 return [...draft.mentions].sort((a,b)=>a.start-b.start).filter(mention=>{
  const valid=Number.isInteger(mention.start)&&Number.isInteger(mention.end)&&mention.start>=previousEnd&&mention.end>mention.start&&mention.end<=points.length&&points.slice(mention.start,mention.end).join('')===mention.label;
  if(valid)previousEnd=mention.end;
  return valid;
 });
}

export function replaceMentionSelection(draft:MentionDraft,start:number,end:number,replacement:string):MentionDraft {
 const points=Array.from(draft.body);
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>points.length)throw new Error('Invalid mention selection');
 const delta=Array.from(replacement).length-(end-start);
 const mentions=validMentions(draft).flatMap(mention=>{
  if(mention.end<=start)return [mention];
  if(mention.start>=end)return [{...mention,start:mention.start+delta,end:mention.end+delta}];
  // Editing any character inside a token removes its notification entity, keeping the text.
  return [];
 });
 return {body:points.slice(0,start).join('')+replacement+points.slice(end).join(''),mentions};
}

/** Native and DOM text changes preserve only untouched selected entities; never infer @names. */
export function editMentionDraft(draft:MentionDraft,body:string):MentionDraft {
 const before=Array.from(draft.body),after=Array.from(body);
 let start=0;
 while(start<before.length&&start<after.length&&before[start]===after[start])start++;
 let end=before.length,newEnd=after.length;
 while(end>start&&newEnd>start&&before[end-1]===after[newEnd-1]){end--;newEnd--;}
 return replaceMentionSelection(draft,start,end,after.slice(start,newEnd).join(''));
}

/** Half-open code-point selection. Names (including spaces) must match the candidate exactly. */
export function selectMention(draft:MentionDraft,start:number,end:number,candidate:MentionCandidate,canMentionEveryone=false):MentionDraft {
 if(candidate.kind==='everyone'&&!canMentionEveryone)throw new Error('Only the host can mention everyone');
 if(candidate.kind==='user'&&(!candidate.userId||!candidate.displayName))throw new Error('Invalid mention candidate');
 const label=candidate.kind==='everyone'?'@everyone':`@${candidate.displayName}`;
 const updated=replaceMentionSelection(draft,start,end,label+' ');
 if(Array.from(updated.body).length>2000)throw new Error('Messages can be up to 2,000 characters');
 if(updated.mentions.length>=100)throw new Error('Messages can contain up to 100 mentions');
 const mention:SelectedMention=candidate.kind==='everyone'?{kind:'everyone',start,end:start+Array.from(label).length,label}:{kind:'user',userId:candidate.userId!,start,end:start+Array.from(label).length,label};
 return {...updated,mentions:[...updated.mentions,mention].sort((a,b)=>a.start-b.start)};
}

export function removeSelectedMention(draft:MentionDraft,index:number):MentionDraft {
 const mention=draft.mentions[index];
 return mention?replaceMentionSelection(draft,mention.start,mention.end,''):draft;
}

/** No display-only metadata, trimming or UTF-16 offsets cross the API boundary. */
export function messageMentionPayload(draft:MentionDraft):{body:string;mentions:Mention[]} {
 return {body:draft.body,mentions:validMentions(draft).map(mention=>mention.kind==='everyone'?{kind:'everyone',start:mention.start,end:mention.end}:{kind:'user',userId:mention.userId,start:mention.start,end:mention.end})};
}
