import { randomUUID } from 'node:crypto';
import type { Pool,PoolClient } from 'pg';
import { activeSubject,transaction } from './transaction.ts';
import { AssistantError,type AssistantRuntime,type SessionBinding } from '../../../../packages/assistant/src/index.ts';
export type DraftKind='APPLICATION'|'CREATE'|'GROUP';
export interface AIDraft {id:string;kind:DraftKind;targetId:string|null;targetVersion:string|null;editorVersion:string;createdAt:string;text:string|null;fields:{title:string;description:string}|null}
const bad=()=>{throw new AssistantError('AI_CONFLICT');};
/** No fabricated biography or completed business action may be introduced by a text candidate. */
export function validateDraftText(text:unknown,input:string,min:number,max:number):string{
  if(typeof text!=='string'||text.trim().length<min||text.trim().length>max||/https?:\/\/|www\.|<\/?[a-z][^>]*>/i.test(text))return bad();
  const normalized=text.trim();
  if(/\b(booked|reserved|paid|approved|accepted your|confirmed your|sent the message|guarantee|allergy.safe)\b|已(付款|预约|批准|发送|订好)|保证.*(过敏|安全)/i.test(normalized))return bad();
  // Reject identity/biography assertions unless the user supplied the same sentence. Explicit
  // free-form claims are never inferred from a name, language preference or selected restaurant.
  const claims=normalized.match(/(?:I (?:am|work|study|live|have|speak|enjoy|love|like|grew|moved|graduated|own|know|was)|I'm|我(?:是|在|住|会|有|喜欢|爱|来自|毕业|工作|学))[^.!?。！？\n]*/gi)??[];
  if(claims.some(claim=>!input.toLowerCase().includes(claim.toLowerCase())))return bad();
  return normalized;
}
export async function draftTarget(db:Pool|PoolClient,subject:string,kind:DraftKind,targetId:string|null):Promise<string|null>{
  if(kind==='CREATE')return null;
  if(!targetId||!/^[0-9a-f-]{36}$/i.test(targetId))return bad();
  const user=subject.startsWith('user:')?subject.slice(5):null;
  if(kind==='GROUP'){
    if(!user)throw new AssistantError('AI_SUPERSEDED');
    const {rows:[row]}=await db.query(`SELECT c.version::text FROM conversations c WHERE c.id=$1 AND c.kind='GROUP' AND c.dissolved_at IS NULL AND EXISTS(SELECT 1 FROM membership_intervals i WHERE i.conversation_id=c.id AND i.user_id=$2 AND i.leave_seq IS NULL)`,[targetId,user]);
    if(!row)throw new AssistantError('AI_SUPERSEDED');return row.version;
  }
  const {rows:[row]}=await db.query(`SELECT m.version::text FROM meals m WHERE m.id=$1 AND m.status='OPEN' AND m.closes_at>clock_timestamp() AND m.starts_at>clock_timestamp() AND ($2::uuid IS NULL OR m.host_id<>$2)
    AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.meal_id=m.id AND a.user_id=$2 AND a.state IN ('PENDING','CONFIRMED','DECLINED'))
    AND m.capacity>1+(SELECT count(*) FROM applications a WHERE a.meal_id=m.id AND a.state='CONFIRMED')`,[targetId,user]);
  if(!row)throw new AssistantError('AI_SUPERSEDED');return row.version;
}
export function createDraft(kind:DraftKind,targetId:string|null,targetVersion:string|null,editorVersion:string,output:unknown,input:string):AIDraft{
  if(!output||typeof output!=='object'||Array.isArray(output))return bad();
  const value=output as Record<string,unknown>;let text:string|null=null;let fields:AIDraft['fields']=null;
  if(kind==='CREATE'){
    if(Object.keys(value).sort().join(',')!=='description,title')return bad();
    fields={title:validateDraftText(value.title,input,5,80),description:validateDraftText(value.description,input,20,1000)};
  }else{
    if(Object.keys(value).join(',')!=='text')return bad();text=validateDraftText(value.text,input,kind==='APPLICATION'?20:1,kind==='APPLICATION'?300:1000);
  }
  return {id:randomUUID(),kind,targetId,targetVersion,editorVersion,createdAt:new Date().toISOString(),text,fields};
}
export async function transferDraft(db:Pool,runtime:AssistantRuntime,id:string,binding:SessionBinding,input:{draftId:string;editorKind:DraftKind;targetId:string|null;editorVersion:string;replaceConfirmed:boolean}){
  return transaction(db,async c=>{
    await activeSubject(c,binding.subject);
    let draft:AIDraft;
    try{
      const stored=runtime.artifact(id,binding,input.draftId) as {requestId:string;value:AIDraft};
      const {rows:[accepted]}=await c.query(`SELECT state FROM ai_requests WHERE subject=$1 AND request_id=$2 AND session_id=$3`,[binding.subject,stored.requestId,id]);
      if(accepted?.state!=='SUCCEEDED')throw new AssistantError('DRAFT_EXPIRED');
      draft=stored.value;
    }catch{throw new AssistantError('DRAFT_EXPIRED');}
    if(draft.kind!==input.editorKind||draft.targetId!==input.targetId)throw new AssistantError('TARGET_CHANGED');
    if(input.editorVersion!==draft.editorVersion&&!input.replaceConfirmed)throw new AssistantError('EDITOR_CONFLICT');
    if(draft.kind==='GROUP')await c.query(`SELECT id FROM conversations WHERE id=$1 FOR SHARE`,[draft.targetId]);
    if(draft.kind==='APPLICATION')await c.query(`SELECT id FROM meals WHERE id=$1 FOR SHARE`,[draft.targetId]);
    let version:string|null;
    try{version=await draftTarget(c,binding.subject,draft.kind,draft.targetId);}catch{throw new AssistantError('TARGET_CHANGED');}
    if(version!==draft.targetVersion)throw new AssistantError('TARGET_CHANGED');
    runtime.read(id,binding);
    // Return the same immutable replacement on repeats. Never append or call a business command.
    return draft;
  });
}
