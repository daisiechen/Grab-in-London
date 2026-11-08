import { useEffect, useRef, type ReactNode } from 'react';
import { useTelemetry } from '../../api/telemetry.tsx';
import type { Meal } from '../../api/types.ts';
import { useSession } from '../../api/session.tsx';

/** A continuous foreground second at >=50% visibility; server verifies actual eligibility. */
export function ObservedMeal({meal,requestId,children}:{meal:Meal;requestId:string|undefined;children:ReactNode}) {
  const ref=useRef<HTMLDivElement>(null),sent=useRef(false);
  const telemetry=useTelemetry(),emit=useRef(telemetry.emit);emit.current=telemetry.emit;
  const {state}=useSession();
  const eligible=state.status==='signed-in'?meal.allowedActions.includes('APPLY'):state.status==='guest'&&meal.status==='OPEN'&&Date.parse(meal.startsAt.instant)>Date.now()&&Date.parse(meal.closesAt.instant)>Date.now()&&meal.confirmedCount<meal.capacity;
  useEffect(()=>{
    sent.current=false;
    if(!eligible||!telemetry.enabled||!requestId||!ref.current||typeof IntersectionObserver==='undefined')return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    let visible=false;
    const stop=()=>{clearTimeout(timer);timer=undefined;};
    const start=()=>{
      stop();
      if(!visible||sent.current||document.visibilityState!=='visible')return;
      timer=setTimeout(()=>{
        if(!visible||document.visibilityState!=='visible'||Date.parse(meal.startsAt.instant)<=Date.now()||Date.parse(meal.closesAt.instant)<=Date.now())return;
        sent.current=true;
        emit.current('meal_impression',{mealId:meal.id,discoveryRequestId:requestId,visibleRatio:0.5,durationMs:1000,eligible:true,foreground:true});
      },1000);
    };
    const observer=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting&&e.intersectionRatio>=0.5);start();},{threshold:[0,0.5]});
    observer.observe(ref.current);document.addEventListener('visibilitychange',start);
    return()=>{stop();observer.disconnect();document.removeEventListener('visibilitychange',start);};
  },[eligible,meal.id,meal.startsAt.instant,meal.closesAt.instant,requestId,telemetry.enabled]);
  return <div ref={ref} className="observed">{children}</div>;
}
