import {useEffect,useRef,type ReactNode} from 'react';

/** An actual viewport observation, never DOM insertion or fetching, authorizes a read position. */
export function VisibleMessage({seq,enabled,presented,children}:{seq:string;enabled:boolean;presented:(seq:string)=>void;children:ReactNode}) {
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!enabled||!ref.current||typeof IntersectionObserver==='undefined')return;
  let active=true;
  const observer=new IntersectionObserver(entries=>{
   if(active&&document.visibilityState==='visible'&&entries.some(entry=>entry.target===ref.current&&entry.isIntersecting&&entry.intersectionRatio>=.8))presented(seq);
  },{threshold:[0,.8]});
  observer.observe(ref.current);
  return()=>{active=false;observer.disconnect();};
 },[enabled,presented,seq]);
 return <div ref={ref} data-message-seq={seq}>{children}</div>;
}
