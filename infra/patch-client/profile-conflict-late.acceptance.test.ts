/** Codex acceptance: the second await in profile conflict recovery belongs to the original scope. */
import {expect,it,vi} from 'vitest';
import {createApiClient} from '../../packages/client/src/http.ts';
import {SessionManager} from '../../apps/ios/src/features/auth/session.ts';
import {ProfileSaver} from '../../apps/ios/src/features/profile/save.ts';
it('does not update session from a conflict reload that finishes after saver reset',async()=>{
 let finish!:(r:Response)=>void;const held=new Promise<Response>(r=>{finish=r;});let started!:()=>void;const reading=new Promise<void>(r=>{started=r;});
 const api=createApiClient({baseUrl:'https://api.test',credentials:{kind:'none'},fetch:async(_url,init)=>{
  if(init?.method==='PATCH')return new Response(JSON.stringify({error:{code:'VERSION_CONFLICT',message:'Changed elsewhere'}}),{status:409,headers:{'content-type':'application/json'}});
  started();return held;
 }});
 const session=new SessionManager({api,withToken:()=>api,store:{readRefresh:async()=>null,writeRefresh:async()=>{},clear:async()=>{}},installMarker:null,newId:()=> 'synthetic',onClear:[]});
 const update=vi.spyOn(session,'updateUser');const saver=new ProfileSaver(api,session,()=> '6f1c2a4e-9b3d-4c5e-8f7a-1b2c3d4e5f60');
 const saving=saver.save({bio:'A synthetic profile introduction.'},'0');await reading;
 saver.reset();finish(new Response(JSON.stringify({data:{id:'old-account',version:'1'}}),{status:200,headers:{'content-type':'application/json'}}));
 await saving;expect(update).not.toHaveBeenCalled();
});
