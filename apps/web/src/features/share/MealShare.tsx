import {useEffect,useRef,useState} from 'react';
import {publicMealInvitation,type PublicMealShareInput} from '@fancy/client';
import {Primary,TextAction} from '../../ui/components.tsx';
import {Sheet} from '../../ui/Sheet.tsx';

/** Browser capabilities are invoked only by a click; resolving share never proves delivery. */
export function MealShare({meal,origin=String(import.meta.env.VITE_PUBLIC_MEAL_ORIGIN??'')}:{meal:PublicMealShareInput;origin?:string}){
 const [open,setOpen]=useState(false),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 const epoch=useRef(0),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>()=>{epoch.current++;},[]);
 let invitation:ReturnType<typeof publicMealInvitation>|null=null;
 try{invitation=publicMealInvitation(origin,meal);}catch{/* Invalid configuration never falls back to the current private URL. */}
 const changeOpen=(value:boolean)=>{epoch.current++;setOpen(value);setNote('');setBusy(false);};
 const copy=async(value:string)=>{
  const generation=epoch.current;setBusy(true);setNote('');
  try{
   if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
   await navigator.clipboard.writeText(value);
   if(generation===epoch.current)setNote('Copied.');
  }catch{if(generation===epoch.current)setNote('Couldn’t copy. Select the link or invitation text below to copy it.');}
  finally{if(generation===epoch.current)setBusy(false);}
 };
 const share=async()=>{
  if(!invitation)return;
  if(!navigator.share){await copy(invitation.url);return;}
  const generation=epoch.current;setBusy(true);setNote('');
  try{await navigator.share({title:invitation.title,text:invitation.text,url:invitation.url});}
  catch(error){if(generation===epoch.current&&!(error&&typeof error==='object'&&'name' in error&&error.name==='AbortError'))setNote('System sharing isn’t available. You can copy the link below.');}
  finally{if(generation===epoch.current)setBusy(false);}
 };
 return <>
  <button ref={trigger} type="button" className="primary secondary" aria-label="Share meal" onClick={()=>changeOpen(true)}>Share</button>
  <Sheet open={open} onOpenChange={changeOpen} title="Share this meal" onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus();}}>
   {invitation?<>
    <p>Share the public meal link. Availability can change; everyone reviews the latest meal before requesting to join.</p>
    <Primary disabled={busy} onClick={()=>void share()}>More sharing options</Primary>
    <a className="primary secondary" href={invitation.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>
    <Primary secondary disabled={busy} onClick={()=>void copy(invitation.url)}>Copy link for WeChat</Primary>
    <Primary secondary disabled={busy} onClick={()=>void copy(invitation.url)}>Copy link</Primary>
    <Primary secondary disabled={busy} onClick={()=>void copy(invitation.text)}>Copy invitation text</Primary>
    <div className="field"><label htmlFor="meal-share-link">Meal link</label><input id="meal-share-link" readOnly value={invitation.url} onFocus={event=>event.currentTarget.select()}/></div>
    <div className="field"><label htmlFor="meal-share-text">Invitation text</label><textarea id="meal-share-text" readOnly rows={6} value={invitation.text}/></div>
    <p className="muted" role="status">{note||'Opening a sharing app doesn’t confirm that an invitation was sent.'}</p>
   </>:<p role="status">Sharing is temporarily unavailable. You can still view this meal.</p>}
   <TextAction onClick={()=>changeOpen(false)}>Close</TextAction>
  </Sheet>
 </>;
}
