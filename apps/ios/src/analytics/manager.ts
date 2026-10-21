import { createApiClient,type RequestOf } from '@fancy/client';
import type { OperationId } from '@fancy/contracts';
import { allowedEvent,type EventType,type Properties } from './allowlist.ts';
export const ANALYTICS_CONSENT_VERSION='2026-10-21';
type Event=RequestOf<'ingestEvents'>['body']['events'][number];
interface Identity {key:string;ready:boolean;authenticated:boolean;accessToken:string|null}
interface Deps {baseUrl:string;fetch:typeof fetch;identity():Identity;newId():string;now():number}
export interface AnalyticsState {choice:'unknown'|'allowed'|'declined';enabled:boolean;busy:boolean;error:string|null;generation:number}
const scopePattern=/^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/;
export function responseScope(headers:Headers):string|null {
  const native=headers.get('x-fancy-analytics-scope');if(native&&scopePattern.test(native))return native;
  const cookie=headers.get('set-cookie')?.match(/(?:^|[,;]\s*)fancy_analytics_scope=([A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43})(?:;|,|$)/)?.[1];return cookie??null;
}

/** No persistence and no AI credentials. RAM events are bounded, fixed metadata and epoch scoped. */
export class AnalyticsManager {
  private state:AnalyticsState={choice:'unknown',enabled:false,busy:false,error:null,generation:0};
  private readonly listeners=new Set<()=>void>();
  private identityKey:string;
  private scope:string|null=null;
  private queue:Event[]=[];
  private foreground=true;
  private flight:Promise<void>|null=null;
  private command:Promise<void>=Promise.resolve();
  private localId:string;
  private readonly deps:Deps;
  constructor(deps:Deps){this.deps=deps;this.identityKey=deps.identity().key;this.localId=deps.newId();}
  getState=()=>this.state;
  subscribe=(callback:()=>void)=>{this.listeners.add(callback);return()=>{this.listeners.delete(callback);};};
  private set(patch:Partial<AnalyticsState>){this.state={...this.state,...patch};for(const callback of this.listeners)callback();}
  syncIdentity=()=>{const identity=this.deps.identity();if(identity.key!==this.identityKey){this.identityKey=identity.key;this.clear();}return identity;};
  clear=()=>{this.scope=null;this.queue=[];this.localId=this.deps.newId();this.set({choice:'unknown',enabled:false,busy:false,error:null,generation:this.state.generation+1});};
  setForeground(active:boolean){this.foreground=active;if(active)void this.flush();}
  headersFor=(operation:OperationId):Record<string,string>=>{
    this.syncIdentity();
    return operation==='discoverMeals'&&this.state.enabled&&this.scope?{'x-fancy-analytics':'enabled',cookie:`fancy_analytics_scope=${this.scope}`}:{'x-fancy-analytics':'disabled'};
  };
  private async send(body:RequestOf<'ingestEvents'>['body'],scope:string|null,token:string|null){
    let returnedScope:string|null=null;
    const client=createApiClient({baseUrl:this.deps.baseUrl,credentials:{kind:'bearer',accessToken:()=>token},headers:()=>({'x-fancy-analytics-client':'native','x-fancy-analytics':body.events.length?'enabled':'disabled',...(scope?{cookie:`fancy_analytics_scope=${scope}`}:{})}),fetch:async(input,init)=>{
      // Avoid a persistent native cookie jar: this visitor proof lives only in RAM.
      const response=await this.deps.fetch(input,{...init,credentials:'omit'});returnedScope=responseScope(response.headers);return response;
    }});
    await client.call('ingestEvents',{body});return returnedScope;
  }
  choose(allow:boolean):Promise<void>{
    const identity=this.syncIdentity(),oldScope=this.scope;
    const generation=this.state.generation+1;
    this.scope=null;this.queue=[];this.set({choice:allow?'unknown':'declined',enabled:false,busy:true,error:null,generation});
    const task=async()=>{
      this.syncIdentity();
      if(generation!==this.state.generation)return;
      if(!identity.ready||identity.authenticated&&!identity.accessToken){this.set({busy:false,error:'Check your sign-in before changing analytics. You can keep using Fancy.'});return;}
      try {
        const scope=await this.send({schemaVersion:1,consent:{analytics:allow,version:ANALYTICS_CONSENT_VERSION},events:[]},oldScope,identity.accessToken);
        this.syncIdentity();if(generation!==this.state.generation)return;
        if(allow&&!scope)throw new Error('SCOPE_UNAVAILABLE');
        this.scope=allow?scope:null;this.set({choice:allow?'allowed':'declined',enabled:allow,busy:false});
      } catch {if(generation===this.state.generation){this.scope=null;this.set({busy:false,error:allow?'Analytics could not be enabled. Its native visitor protocol may be unavailable.':'Analytics is off on this device. The server could not be updated; try again.'});}}
    };
    this.command=this.command.then(task,task);return this.command;
  }
  emit(type:EventType,properties:Properties):boolean {
    const identity=this.syncIdentity();
    if(!this.foreground||!identity.ready||!this.state.enabled||!this.scope||!allowedEvent(type,properties)||this.queue.length>=20)return false;
    this.queue.push({eventId:this.deps.newId(),type,occurredAt:new Date(this.deps.now()).toISOString(),anonymousId:this.localId,sessionId:this.localId,appVersion:'ios-mvp-1',properties:{...properties}});
    void this.flush();return true;
  }
  flush():Promise<void>{
    this.syncIdentity();if(this.flight)return this.flight;
    const generation=this.state.generation,identity=this.deps.identity();
    if(!this.foreground||!this.state.enabled||!this.scope||!this.queue.length||identity.authenticated&&!identity.accessToken)return Promise.resolve();
    const batch=this.queue.slice(),scope=this.scope;
    let success=false;
    const flight=(async()=>{
      try {
        await this.send({schemaVersion:1,consent:{analytics:true,version:ANALYTICS_CONSENT_VERSION},events:batch},scope,identity.accessToken);
        success=true;
        this.syncIdentity();if(generation===this.state.generation){const ids=new Set(batch.map(e=>e.eventId));this.queue=this.queue.filter(e=>!ids.has(e.eventId));}
      } catch {/* A retry in this same RAM epoch retains the exact event IDs; no automatic retry loop. */}
    })();
    this.flight=flight;void flight.finally(()=>{if(this.flight===flight){this.flight=null;if((success||generation!==this.state.generation)&&this.queue.length)void this.flush();}});return flight;
  }
}
