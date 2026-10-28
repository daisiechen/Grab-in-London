import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {loadConfig} from '@fancy/config';
import {DomainError} from '../common/errors.ts';
import {buildServer} from '../http/server.ts';
import {Browser,createHarness,json,WEB_ORIGIN,type Harness} from '../test/harness.ts';
import {londonTime} from '../meals/time.ts';
import type {AreaPolygons,Polygon} from './areas.ts';
import {loadLondonAreas} from './london-areas.ts';
let h:Harness;const apps:Awaited<ReturnType<typeof buildServer>>[]=[];
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));await h.app.close();});afterAll(async()=>{for(const app of apps)await app.close();await h.close();});
const square:Polygon=[[[0,0],[2,0],[2,2],[0,2],[0,0]]];
const dataset=(revision:number,areaCode='fixture-a',version=`synthetic-v${revision}`):AreaPolygons=>({kind:'fixture',revision,version,areas:[{areaCode,geometry:{type:'Polygon',coordinates:square}}]});
async function server(areaPolygons?:AreaPolygons,lookup?:(placeId:string)=>Promise<{lat:number;lng:number}>){
 const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'});
 const app=await buildServer({config,pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN,...(areaPolygons?{areaPolygons}:{}),placesProvider:{kind:'fixture',search:async()=>({places:[],nextCursor:null}),details:async placeId=>({placeId,name:'PROVIDER_NAME_CANARY',address:'PROVIDER_ADDRESS_CANARY',location:lookup?await lookup(placeId):{lng:1,lat:1},attributions:[],photoRefs:[]})}});
 apps.push(app);h.app=app;
}
async function actor(){const b=new Browser(h);await b.signInWithEmail(`${randomUUID()}@example.invalid`);const profile=await b.request('PATCH','/v1/me',{body:{displayName:'Area Fixture',bio:'Synthetic profile for polygon mapping and meal region checks.',languages:['en'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:{'idempotency-key':randomUUID(),'if-match':'"1"'}});expect(profile.statusCode).toBe(200);return b;}
const confirm=(b:Browser,placeId:string,key=randomUUID())=>b.request('POST','/v1/venues/confirm',{body:{placeId},headers:{'idempotency-key':key}});
const time=(t:ReturnType<typeof londonTime>)=>({localDate:t.localDate,localTime:t.localTime,timeZone:t.timeZone,utcOffsetMinutes:t.utcOffsetMinutes});
async function publish(b:Browser,venueRef:string){const start=londonTime(new Date(Math.floor((Date.now()+86_400_000)/60_000)*60_000)),close=londonTime(new Date(Date.parse(start.instant)-3_600_000));
 const result=await b.request('POST','/v1/meals',{body:{venueRef,title:'Synthetic mapped venue meal',description:'A meal to preserve its publication area when polygons change.',start:time(start),close:time(close),minimum:2,capacity:4,budgetMinPence:1000,budgetMaxPence:3000,languages:['en'],mood:'EASY_CONVERSATION',bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21'},headers:{'idempotency-key':randomUUID()}});expect(result.statusCode,result.body).toBe(201);return json(result).data;}
it('maps only server verified coordinates, persists code/version only, updates stable ref on new revision and preserves old meal area on same-venue edits',async()=>{
 await server(dataset(1));const b=await actor(),placeId=`synthetic_${randomUUID()}`,key=randomUUID();const first=await confirm(b,placeId,key);expect(first.statusCode,first.body).toBe(200);expect(json(first).data.areaCode).toBe('fixture-a');const ref=json(first).data.venueRef as string;
 const oldMeal=await publish(b,ref);
 await server(dataset(2,'fixture-b'));const updated=await confirm(b,placeId);expect(updated.statusCode,updated.body).toBe(200);expect(json(updated).data).toMatchObject({venueRef:ref,areaCode:'fixture-b',location:null,name:null});
 expect(json(await confirm(b,placeId,key))).toEqual(json(first));
 const row=(await h.db.pool.query(`SELECT * FROM venues WHERE id=$1`,[ref])).rows[0];expect(row).toMatchObject({area_code:'fixture-b',area_version:'synthetic-v2',area_revision:'2'});
 for(const value of ['PROVIDER_NAME_CANARY','PROVIDER_ADDRESS_CANARY','"location"','"lat"','"lng"'])expect(JSON.stringify(row)).not.toContain(value);
 const edit=await b.request('PATCH',`/v1/meals/${oldMeal.id}`,{body:{title:'A new title keeping its original publication region'},headers:{'idempotency-key':randomUUID(),'if-match':`"${oldMeal.version}"`}});expect(edit.statusCode,edit.body).toBe(200);expect(json(edit).data.areaCode).toBe('fixture-a');
 expect((await publish(b,ref)).areaCode).toBe('fixture-b');
 const other=(await confirm(b,`synthetic_other_${randomUUID()}`)).json().data;
 const change=await b.request('PATCH',`/v1/meals/${oldMeal.id}`,{body:{venueRef:other.venueRef},headers:{'idempotency-key':randomUUID(),'if-match':`"${json(edit).data.version}"`}});expect(change.statusCode,change.body).toBe(200);expect(json(change).data.areaCode).toBe('fixture-b');
 const intent=(await h.db.pool.query(`SELECT response_json FROM idempotency WHERE operation='confirmVenue' AND key=$1`,[key])).rows[0];for(const value of ['PROVIDER_NAME_CANARY','PROVIDER_ADDRESS_CANARY','"lat"','"lng"'])expect(JSON.stringify(intent)).not.toContain(value);
});
it('old in-flight and fresh old-deployment confirmations cannot downgrade a newer committed mapping',async()=>{
 let slow=false,entered=false,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await server(dataset(1),async()=>{if(slow){entered=true;await gate;}return {lng:1,lat:1};});const b=await actor(),placeId=`synthetic_${randomUUID()}`;expect((await confirm(b,placeId)).statusCode).toBe(200);
 slow=true;const pending=confirm(b,placeId);const end=performance.now()+3000;while(!entered){if(performance.now()>end)throw Error('controlled provider did not enter');await new Promise<void>(resolve=>setImmediate(resolve));}
 try{await server(dataset(2,'fixture-b'));expect((await confirm(b,placeId)).statusCode).toBe(200);}finally{release();}
 expect((await pending).statusCode).toBe(409);
 for(const config of [dataset(1),dataset(2,'fixture-b','different-v2'),dataset(2,'different-code'),undefined]){await server(config);const result=await confirm(b,placeId);expect(result.statusCode,result.body).toBe(409);}
 expect((await h.db.pool.query(`SELECT area_code,area_version,area_revision FROM venues WHERE place_id=$1`,[placeId])).rows[0]).toEqual({area_code:'fixture-b',area_version:'synthetic-v2',area_revision:'2'});
});
it('unknown coverage and absent dataset do not guess a London area; bad or unavailable verified location cannot create a reference',async()=>{
 await server(dataset(1),async()=>({lng:10,lat:10}));const b=await actor();const outside=await confirm(b,`synthetic_${randomUUID()}`);expect(outside.statusCode).toBe(200);expect(json(outside).data.areaCode).toBe('unknown');
 await server();const missing=await confirm(b,`synthetic_${randomUUID()}`);expect(missing.statusCode).toBe(200);expect(json(missing).data.areaCode).toBe('unknown');
 for(const lookup of [async()=>({lng:NaN,lat:1}),async()=>{throw new DomainError('PROVIDER_UNAVAILABLE','Controlled provider outage');}]){
  await server(dataset(1),lookup);const placeId=`synthetic_${randomUUID()}`;expect((await confirm(b,placeId)).statusCode).toBe(503);expect((await h.db.pool.query(`SELECT id FROM venues WHERE place_id=$1`,[placeId])).rowCount).toBe(0);
 }
});
it('the shipped verified London dataset maps a confirmed restaurant to its neighbourhood and records the dataset version',async()=>{
 const london=loadLondonAreas();
 await server(london,async placeId=>placeId.startsWith('soho_')?{lat:51.5155,lng:-0.1320}:{lat:51.5074,lng:-0.1350});const b=await actor();
 const soho=await confirm(b,`soho_${randomUUID()}`);expect(soho.statusCode,soho.body).toBe(200);expect(json(soho).data.areaCode).toBe('soho');
 const stJames=await confirm(b,`stjames_${randomUUID()}`);expect(json(stJames).data.areaCode).toBe('st-jamess');
 expect((await h.db.pool.query(`SELECT area_code,area_version,area_revision FROM venues WHERE id=$1`,[json(soho).data.venueRef])).rows[0]).toEqual({area_code:'soho',area_version:london.version,area_revision:'1'});
 expect((await publish(b,json(soho).data.venueRef)).areaCode).toBe('soho');
});
