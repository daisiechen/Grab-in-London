import {useEffect,useRef,useState} from 'react';
import {ApiError,newIntentKey} from '@fancy/client';
import {useApi} from '../../api/ApiProvider.tsx';
import {FormError,Primary,TextAction} from '../../ui/components.tsx';
import {clearLinkTicket,pendingLink,type PendingLink} from './completeSignIn.ts';
import {readJson} from '../../lib/storage.ts';

/** Proof and idempotent payload remain RAM-only. Never retry a link without a user action. */
export function LinkConfirmation({pending,proof,onDone,onCancel,onReverify}:{pending:PendingLink;proof:string;onDone:()=>void;onCancel:()=>void;onReverify:()=>void}){
 const {api}=useApi();const [key]=useState(newIntentKey);const [deadline]=useState(()=>Date.now()+300_000);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ended,setEnded]=useState(false);
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const attempt=`${pending.ticket}:${proof}`;const renderedAttempt=useRef(attempt);renderedAttempt.current=attempt;
 const ownsAttempt=()=>{const current=readJson<PendingLink>('auth.linkTicket');return active.current&&renderedAttempt.current===attempt&&current?.ticket===pending.ticket&&current.phase==='original'&&current.expectedProofId===null;};
 const cancel=()=>{if(!active.current||renderedAttempt.current!==attempt)return;if(ownsAttempt()){clearLinkTicket();onCancel();}else if(!readJson('auth.linkTicket'))onCancel();};
 useEffect(()=>{const timer=setTimeout(()=>{if(!ownsAttempt())return;setBusy(false);clearLinkTicket();setEnded(true);setError('This linking request expired. Start again.');},Math.max(0,Math.min(Date.parse(pending.expiresAt),deadline)-Date.now()));return()=>clearTimeout(timer);},[pending.expiresAt,deadline,attempt]);
 const connect=async()=>{
  const current=pendingLink();
  if(!ownsAttempt()||!current||Date.now()>=deadline){if(!readJson('auth.linkTicket')||ownsAttempt()){if(ownsAttempt())clearLinkTicket();setEnded(true);setError('This linking request expired or the session changed. Start again.');}return;}
  setBusy(true);setError('');
  try{await api.client.call('linkIdentity',{idempotencyKey:key,body:{linkTicket:pending.ticket,originalChallengeProof:proof}});if(!ownsAttempt())return;clearLinkTicket();onDone();}
  catch(e){
   if(!ownsAttempt())return;
   if(e instanceof ApiError&&e.code==='REAUTH_REQUIRED'&&pendingLink()?.ticket===pending.ticket){onReverify();return;}
   if(e instanceof ApiError&&e.kind!=='network'&&e.status!==undefined&&e.status<500){clearLinkTicket();setEnded(true);}
   setError(e instanceof ApiError&&e.code==='ACCOUNT_LINK_CONFLICT'?'Both accounts have activity and cannot be merged. Use your original sign-in.':'We couldn’t connect this sign-in. Retry only if this request is still available.');
  }finally{if(active.current&&renderedAttempt.current===attempt&&(ownsAttempt()||!readJson('auth.linkTicket')))setBusy(false);}
 };
 return <div className="scroll auth-state"><h1>Connect this sign-in?</h1><p className="prose">Your original sign-in is verified. Confirm to add the new sign-in method to this account.</p><FormError>{error}</FormError><Primary disabled={busy||ended} onClick={()=>void connect()}>Connect this sign-in method</Primary><TextAction disabled={busy} onClick={cancel}>Cancel linking</TextAction></div>;
}
