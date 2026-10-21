import {useEffect,useMemo,useRef,useState} from 'react';
import {ApiError,type ResponseOf} from '@fancy/client';
import {useServices,useSessionState} from '../../services.tsx';
import {Primary,TextAction} from '../../ui/Button.tsx';
import {Body} from '../../ui/Text.tsx';
import {FormMessage} from '../../ui/FormMessage.tsx';
import {Sheet} from '../../ui/Sheet.tsx';

type BlockState=ResponseOf<'getBlock'>['data'];
/** Only the actor's own setting is read. Neither a direct-chat permission nor 409 implies block state. */
export function MemberSafety({subjectId,name}:{subjectId:string;name:string}){
 const {api,session:manager,newId}=useServices();const session=useSessionState();
 const actor=session.status==='signedIn'?session.session.user.id:null;
 const scope=useMemo(()=>({active:true,reading:false,writing:false,generation:manager.generation,actor,subjectId,keys:new Map<string,string>()}),[actor,subjectId,manager.generation]);
 const scopeRef=useRef(scope);scopeRef.current=scope;
 const [setting,setSetting]=useState<{scope:typeof scope;data:BlockState}|null>(null);
 const [pending,setPending]=useState<{scope:typeof scope;blocked:boolean;version:string}|null>(null);
 const [notice,setNotice]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const eligible=actor!==null&&actor!==subjectId;
 const current=()=>scope.active&&scopeRef.current===scope&&manager.generation===scope.generation;
 const data=setting?.scope===scope?setting.data:null;
 const confirmation=pending?.scope===scope?pending:null;
 const reload=async(message:string|null=null)=>{
  if(!eligible||!current()||scope.reading)return;
  scope.reading=true;setLoading(true);setSetting(null);setError(null);setPending(null);
  try{const result=await api.call('getBlock',{params:{subjectId}});if(!current())return;if(result.data.subjectId!==subjectId)throw new Error('TARGET_CHANGED');setSetting({scope,data:result.data});setNotice(message);}
  catch{if(current()){setSetting(null);setError('We couldn’t load your safety setting. Reload before making a change.');}}
  finally{scope.reading=false;if(current())setLoading(false);}
 };
 useEffect(()=>{
  scope.active=true;setSetting(null);setPending(null);setNotice(null);setError(null);setBusy(false);setLoading(false);
  if(eligible)void reload();
  return()=>{scope.active=false;};
  // Scope captures actor, target and generation. Old completions cannot affect a replacement scope.
 },[scope]);
 if(!eligible)return null;
 const confirm=async()=>{
  if(!confirmation||!data||!current()||scope.writing||scope.reading||confirmation.version!==data.version)return;
  const intent=confirmation;const id=`${intent.blocked}:${intent.version}`;
  if(!scope.keys.has(id))scope.keys.set(id,newId());scope.writing=true;setBusy(true);setError(null);
  try{const result=await api.call(intent.blocked?'block':'unblock',{params:{subjectId},ifMatch:intent.version,idempotencyKey:scope.keys.get(id)!});
   if(!current())return;if(result.data.subjectId!==subjectId)throw new Error('TARGET_CHANGED');scope.keys.delete(id);setSetting({scope,data:result.data});setPending(null);setNotice(intent.blocked?'Member blocked. Private contact is disabled. Shared groups are unchanged.':'Member unblocked. Your previous connection is not restored.');
  }catch(cause){if(!current())return;
   if(cause instanceof ApiError&&cause.kind==='conflict'){scope.keys.delete(id);setPending(null);await reload('Safety settings changed. Review the refreshed setting and confirm again.');}
   else{if(cause instanceof ApiError&&!cause.retryable)scope.keys.delete(id);setError('We couldn’t save this safety setting. Your confirmation is kept.');}
  }finally{scope.writing=false;if(current())setBusy(false);}
 };
 return <>
  <FormMessage message={notice} tone="info"/>
  {!confirmation?<FormMessage message={error}/>:null}
  {loading?<Body muted>Loading safety settings…</Body>:null}
  {!data&&!loading?<TextAction label="Reload safety settings" onPress={()=>void reload()} disabled={busy}/>:null}
  {data?<TextAction destructive label={`${data.blocked?'Unblock':'Block'} ${name}`} disabled={busy||loading} onPress={()=>{setError(null);setPending({scope,blocked:!data.blocked,version:data.version});}}/>:null}
  <Sheet visible={confirmation!==null} title={`${confirmation?.blocked?'Block':'Unblock'} ${name}?`} onClose={()=>{if(!busy)setPending(null);}}>
   {confirmation?.blocked?<Body>Private messages will stop and both reconnect choices will be cleared. Shared meal groups are unaffected.</Body>:null}
   <Body>Your previous connection will not be restored. Both people must choose again.</Body>
   <FormMessage message={error}/>
   <Primary secondary label="Cancel" disabled={busy} onPress={()=>setPending(null)}/>
   <Primary label={confirmation?.blocked?'Confirm block':'Confirm unblock'} disabled={busy||loading||!data} onPress={()=>void confirm()}/>
  </Sheet>
 </>;
}
