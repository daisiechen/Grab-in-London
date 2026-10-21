import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { CLIENT_EVENT_TYPES } from '@fancy/contracts';
import { useApi } from './ApiProvider.tsx';
import { useSession } from './session.tsx';

export const CONSENT_VERSION = '2026-10-21';
type Properties = Record<string,string|number|boolean|null>;
type EventType=(typeof CLIENT_EVENT_TYPES)[number];
interface Telemetry {
  generation:number;
  enabled:boolean;
  choice:'unknown'|'allowed'|'declined';
  busy:boolean;
  error:string;
  choose(allow:boolean):Promise<void>;
  emit(type:Exclude<EventType,'discovery_failed'>,properties:Properties):void;
}

/** Emits once per actual, foreground presentation and consent generation; no input text. */
export function useRenderedEvent(type:Exclude<EventType,'discovery_failed'>,properties:Properties,ready:boolean) {
  const telemetry=useTelemetry(),seen=useRef(new Set<string>()),emit=useRef(telemetry.emit);
  emit.current=telemetry.emit;
  const json=JSON.stringify(properties);
  useEffect(()=>{
    if(!ready||!telemetry.enabled)return;
    const key=`${telemetry.generation}:${type}:${json}`;
    const presented=()=>{if(document.visibilityState==='visible'&&!seen.current.has(key)){seen.current.add(key);emit.current(type,JSON.parse(json) as Properties);}};
    presented();document.addEventListener('visibilitychange',presented);
    return()=>document.removeEventListener('visibilitychange',presented);
  },[json,ready,telemetry.enabled,telemetry.generation,type]);
}
const fallback:Telemetry={generation:0,enabled:false,choice:'unknown',busy:false,error:'',choose:async()=>{},emit:()=>{}};
const Context=createContext<Telemetry>(fallback);
export const useTelemetry=()=>useContext(Context);

/** Consent is deliberately scoped to this mounted account session. No saved opt-in or event backlog. */
export function TelemetryProvider({children}:{children:ReactNode}) {
  const {api}=useApi();
  const {state}=useSession();
  const identity=state.status==='signed-in'?state.session.user.id:state.status;
  const [decision,setDecision]=useState<{identity:string;choice:Telemetry['choice']}>({identity,choice:'unknown'});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const epoch=useRef(0),active=useRef(false),scope=useRef(crypto.randomUUID());
  const choice=decision.identity===identity?decision.choice:'unknown';
  const enabled=choice==='allowed';
  useLayoutEffect(()=>{epoch.current++;active.current=false;api.setAnalyticsEnabled(false);scope.current=crypto.randomUUID();setBusy(false);setError('');return()=>{epoch.current++;active.current=false;api.setAnalyticsEnabled(false);};},[api,identity]);
  const choose=async(allow:boolean)=>{
    const gen=++epoch.current;
    active.current=false;api.setAnalyticsEnabled(false);
    setDecision({identity,choice:allow?'unknown':'declined'});setBusy(true);setError('');
    try {
      await api.client.call('ingestEvents',{body:{schemaVersion:1,consent:{analytics:allow,version:CONSENT_VERSION},events:[]}});
      if(gen!==epoch.current)return;
      active.current=allow;api.setAnalyticsEnabled(allow);setDecision({identity,choice:allow?'allowed':'declined'});
    } catch {if(gen===epoch.current)setError(allow?'Analytics could not be enabled. You can keep using Fancy.':'Analytics is off on this device. The server could not be updated; try again.');}
    finally {if(gen===epoch.current)setBusy(false);}
  };
  const emit:Telemetry['emit']=(type,properties)=>{
    if(!enabled||!active.current||document.visibilityState!=='visible')return;
    const event={eventId:crypto.randomUUID(),type,occurredAt:new Date().toISOString(),anonymousId:scope.current,sessionId:scope.current,appVersion:'web-mvp-1',properties};
    // Event IDs remain stable within this request. Failed delivery is dropped, never replayed after withdrawal.
    void api.client.call('ingestEvents',{body:{schemaVersion:1,consent:{analytics:true,version:CONSENT_VERSION},events:[event]}}).catch(()=>{});
  };
  return <Context.Provider value={{generation:epoch.current,enabled,choice,busy,error,choose,emit}}>{children}</Context.Provider>;
}
