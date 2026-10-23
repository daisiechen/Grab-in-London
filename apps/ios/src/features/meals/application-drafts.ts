import type {SessionState} from '../auth/session.ts';

export interface ApplicationDraft {message:string;key:string;keyFor:string}

/** RAM-only unsent text: expiry hides it until the same account is authenticated again. */
export class ApplicationDraftStore {
 private owner:string|null=null;
 private generation=0;
 private active=false;
 private readonly entries=new Map<string,ApplicationDraft>();

 sync(state:SessionState,generation:number):void {
  this.generation=generation;
  this.active=state.status==='signedIn';
  if(state.status==='signedIn'){
   if(this.owner!==state.session.user.id)this.entries.clear();
   this.owner=state.session.user.id;
  }else if(state.status==='signedOut'&&state.reason!=='expired'){
   this.entries.clear();this.owner=null;
  }
 }
 private allowed(userId:string|null,generation:number){return this.active&&userId!==null&&userId===this.owner&&generation===this.generation;}
 get(mealId:string,userId:string|null,generation:number):ApplicationDraft|undefined {
  if(!this.allowed(userId,generation))return undefined;
  const value=this.entries.get(mealId);return value?{...value}:undefined;
 }
 set(mealId:string,value:ApplicationDraft,userId:string|null,generation:number):void {
  if(this.allowed(userId,generation))this.entries.set(mealId,{...value});
 }
 delete(mealId:string,userId:string|null,generation:number):void {
  if(this.allowed(userId,generation))this.entries.delete(mealId);
 }
}
