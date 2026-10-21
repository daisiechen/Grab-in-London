/** Seed only the explicitly enabled disposable localhost acceptance rig; never a deployment. */
import {randomUUID} from 'node:crypto';
if(process.env.FANCY_QA_LOCAL_FIXTURE!=='1')throw new Error('FANCY_QA_LOCAL_FIXTURE=1 is required');
const origin='http://127.0.0.1:5174',base='http://127.0.0.1:3000';
class FixtureActor{
 cookies=new Map();csrf=null;
 async request(method,path,body,version){const r=await fetch(base+path,{method,headers:{origin,cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; '),...(body===undefined?{}:{'content-type':'application/json'}),...(this.csrf?{'x-csrf-token':this.csrf}:{}),...(method==='GET'?{}:{'idempotency-key':randomUUID()}),...(version?{'if-match':`"${version}"`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});for(const line of r.headers.getSetCookie()){const [pair]=line.split(';'),index=pair.indexOf('=');this.cookies.set(pair.slice(0,index),pair.slice(index+1));}const json=await r.json();if(!r.ok)throw new Error(`${method} ${path}: ${r.status} ${json.error?.code}`);return json.data;}
 async login(email,name){const start=await this.request('POST','/v1/auth/email/start',{email,client:'WEB',clientRequestId:randomUUID()});const result=await this.request('POST','/v1/auth/email/verify',{challengeId:start.challengeId,code:'000000',clientRequestId:randomUUID()});this.csrf=result.session.csrfToken;await this.request('PATCH','/v1/me',{displayName:name,bio:'Disposable synthetic QA profile for Inbox fix verification.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},'1');}
}
const mealId=process.argv[2];
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mealId??''))throw new Error('One synthetic target meal UUID is required');
const email=`qa-extra-${randomUUID()}@example.invalid`,actor=new FixtureActor();
await actor.login(email,'QA Extra Applicant');
const a=await actor.request('POST',`/v1/meals/${mealId}/applications`,{message:'Synthetic additional participant for the controlled local lifecycle QA.'});
const inbox=await actor.request('GET','/v1/inbox');if(!inbox.some(i=>i.application?.mealId===mealId&&i.application?.state==='PENDING'))throw new Error('Synthetic application not pending');
console.log(JSON.stringify({fixtureOnly:true,extraGuestEmail:email,mealId,applicationId:a.id},null,2));
