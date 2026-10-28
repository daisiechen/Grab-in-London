import { createHash } from 'node:crypto';
import { decodeCursor,encodeCursor } from '../common/cursor.ts';
import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../http/context.ts';
import { defineRoute,defineWrite } from '../http/routes.ts';
import { DomainError } from '../common/errors.ts';
import type { VenueService } from '../venues/service.ts';
import { validateSearch } from '../venues/provider.ts';
import { applyForMeal,leaveConfirmed,withdrawPending } from './applications.ts';
import { approveApplication,cancelByHost,declareBooking,editArrangement,publishMeal,type Arrangement,type CreateMealInput,type VerifiedVenue } from './commands.ts';
import { applicationDto,mealDto,parseCursor } from './read.ts';
import { loadSeatEvents,rosterAt,type MealRow } from './lifecycle.ts';
import {hasAnalyticsConsent,recordDiscoveryOutcome} from '../admin/ingest.ts';

export function registerMealRoutes(app:FastifyInstance,deps:AppDeps,venues:VenueService):void {
 async function cursorCodec(actor:string,resource:string,query:object) {
  const {rows:[control]}=await deps.pool.query<{epoch:string}>(`SELECT epoch FROM privacy_control WHERE id=1`);
  const filterHash=createHash('sha256').update(JSON.stringify(Object.entries(query).filter(([key])=>key!=='cursor').sort(([a],[b])=>a.localeCompare(b)))).digest('hex');
  const scope={actor,resource,filterHash,epoch:String(control!.epoch)};
  return {encode:(key:string)=>encodeCursor(deps.config.sessionSecret,scope,key),decode:(cursor:string)=>decodeCursor(deps.config.sessionSecret,scope,cursor)};
 }

 async function verifyVenue(venueRef:string){
  const {rows:[venue]}=await deps.pool.query<{place_id:string}>(`SELECT place_id FROM venues WHERE id=$1`,[venueRef]);
  if(!venue)throw new DomainError('NOT_FOUND','Confirm a restaurant first.');
  const place=await venues.details(venue.place_id);
  if(place.placeId!==venue.place_id)throw new DomainError('STATE_CONFLICT','Restaurant verification changed.');
  return {venueRef,placeId:venue.place_id};
 }
 defineWrite<VerifiedVenue>(app,deps,'createMeal',async({request,auth,prepared},tx)=>{const {meal,now}=await publishMeal(tx,auth.userId,request.body as CreateMealInput,prepared);return {data:await mealDto(tx.client,meal,now,venues,auth.userId,false),version:meal.version,resourceId:meal.id};},undefined,async({request})=>verifyVenue((request.body as CreateMealInput).venueRef));
 defineWrite<VerifiedVenue>(app,deps,'editMeal',async({request,auth,ifMatch,prepared},tx)=>{const {meal,now}=await editArrangement(tx,(request.params as {mealId:string}).mealId,auth.userId,ifMatch,request.body as Partial<Arrangement>,prepared);return {data:await mealDto(tx.client,meal,now,venues,auth.userId,false),version:meal.version,resourceId:meal.id};},undefined,async({request,auth})=>{
  const {rows:[meal]}=await deps.pool.query<{venue_ref:string;host_id:string}>(`SELECT venue_ref,host_id FROM meals WHERE id=$1`,[(request.params as {mealId:string}).mealId]);
  if(!meal)throw new DomainError('NOT_FOUND','Meal not found.');
  if(meal.host_id!==auth.userId)throw new DomainError('FORBIDDEN','Only the host can edit this meal.');
  return verifyVenue((request.body as Partial<Arrangement>).venueRef??meal.venue_ref);
 });
 defineWrite(app,deps,'declareBooking',async({request,auth,ifMatch},tx)=>{const {meal,now}=await declareBooking(tx,(request.params as {mealId:string}).mealId,auth.userId,ifMatch,request.body as {status:string;count:number});return {data:await mealDto(tx.client,meal,now,venues,auth.userId,false),version:meal.version,resourceId:meal.id};});
 defineWrite(app,deps,'cancelMeal',async({request,auth,ifMatch},tx)=>{const {meal,now}=await cancelByHost(tx,(request.params as {mealId:string}).mealId,auth.userId,ifMatch,(request.body as {reason:string}).reason);return {data:await mealDto(tx.client,meal,now,venues,auth.userId,false),version:meal.version,resourceId:meal.id};});
 defineWrite(app,deps,'applyMeal',async({request,auth},tx)=>{const data=await applyForMeal(tx,(request.params as {mealId:string}).mealId,auth.userId,(request.body as {message:string}).message);return {data:await applicationDto(tx.client,data,true),version:String(data.version),resourceId:data.id};});
 defineWrite(app,deps,'withdrawApplication',async({request,auth,ifMatch},tx)=>{const data=await withdrawPending(tx,(request.params as {applicationId:string}).applicationId,auth.userId,ifMatch);return {data:await applicationDto(tx.client,data,true),version:String(data.version),resourceId:data.id};});
 defineWrite(app,deps,'decideApplication',async({request,auth,ifMatch},tx)=>{const {application,meal,conversationId}=await approveApplication(tx,(request.params as {applicationId:string}).applicationId,auth.userId,ifMatch,(request.body as {decision:'APPROVE'|'DECLINE'}).decision);return {data:{application:await applicationDto(tx.client,application,true),mealVersion:meal.version,conversationId},version:String(application.version),resourceId:application.id};});
 defineWrite(app,deps,'leaveMeal',async({request,auth,ifMatch},tx)=>{const {application,meal,now}=await leaveConfirmed(tx,(request.params as {mealId:string}).mealId,auth.userId,ifMatch);return {data:{application:await applicationDto(tx.client,application,true),meal:await mealDto(tx.client,meal,now,venues,auth.userId,false)},version:meal.version,resourceId:meal.id};});
 defineRoute(app,deps,'getMeal',async({request,auth})=>{
  const {rows:[meal]}=await deps.pool.query<MealRow>(`SELECT * FROM meals WHERE id=$1`,[(request.params as {mealId:string}).mealId]);if(!meal)throw new DomainError('NOT_FOUND','Meal not found.');
  const {rows:[application]}=auth?await deps.pool.query(`SELECT * FROM applications WHERE meal_id=$1 AND user_id=$2 ORDER BY round DESC LIMIT 1`,[meal.id,auth.userId]):{rows:[]};
  const {rows:[c]}=auth?await deps.pool.query(`SELECT c.id FROM conversations c WHERE c.meal_id=$1 AND EXISTS(SELECT 1 FROM membership_intervals i WHERE i.conversation_id=c.id AND i.user_id=$2)`,[meal.id,auth.userId]):{rows:[]};
  return {data:{meal:await mealDto(deps.pool,meal,new Date(),venues,auth?.userId??null),myApplication:application?await applicationDto(deps.pool,application,true):null,conversationId:c?.id??null},version:meal.version};
 });
 defineRoute(app,deps,'listApplications',async({request,auth})=>{
  const mealId=(request.params as {mealId:string}).mealId;
  const {rows:[meal]}=await deps.pool.query<{host_id:string}>(`SELECT host_id FROM meals WHERE id=$1`,[mealId]);if(!meal)throw new DomainError('NOT_FOUND','Meal not found.');
  const query=request.query as {cursor?:string;limit?:number};const limit=query.limit??20;const codec=await cursorCodec(auth!.userId,'applications:'+mealId,query);
  let cursor:null|{at:string;id:string}=null;
  if(query.cursor)try{const p=JSON.parse(codec.decode(query.cursor));if(typeof p.at!=='string'||!Number.isFinite(Date.parse(p.at))||typeof p.id!=='string'||!/^[0-9a-f-]{36}$/i.test(p.id))throw new Error();cursor=p;}catch{throw new DomainError('VALIDATION_FAILED','Invalid page cursor.');}
  const {rows}=await deps.pool.query(`SELECT * FROM applications WHERE meal_id=$1 AND ($2::boolean OR user_id=$3) AND ($4::timestamptz IS NULL OR (created_at,id)<($4::timestamptz,$5::uuid)) ORDER BY created_at DESC,id DESC LIMIT $6`,[mealId,auth!.userId===meal.host_id,auth!.userId,cursor?.at??null,cursor?.id??null,limit+1]);
  const hasMore=rows.length>limit;const page=rows.slice(0,limit);const last=page.at(-1);return {data:await Promise.all(page.map(r=>applicationDto(deps.pool,r,true))),page:{hasMore,nextCursor:hasMore&&last?codec.encode(JSON.stringify({at:last.created_at.toISOString(),id:last.id})):null}};
 });
 defineRoute(app,deps,'discoverMeals',async({request,auth})=>{
  const q=request.query as Record<string,string|number|undefined>;
  const boundsValues=[q.north,q.south,q.east,q.west];const n=boundsValues.filter(v=>v!==undefined).length;
  if(n!==0&&n!==4)throw new DomainError('VALIDATION_FAILED','All map bounds are required.');
  const bounds=n===4?{north:Number(q.north),south:Number(q.south),east:Number(q.east),west:Number(q.west)}:undefined;if(bounds)validateSearch({bounds});
  const split=(k:string)=>typeof q[k]==='string'?(q[k] as string).split(','):[];
  const codec=await cursorCodec(auth?.userId??'public','discoverMeals',q);const cursor=parseCursor(typeof q.cursor==='string'?codec.decode(q.cursor):undefined);const limit=Number(q.limit??20);
  let capture=false;try{capture=await hasAnalyticsConsent(deps,request,auth);}catch{request.log.warn({code:'ANALYTICS_SCOPE_UNAVAILABLE'},'discovery analytics scope unavailable');}
  type Candidate=MealRow&{cursor_starts_at:string;statistics_class:string};
  const readBatch=async(after:{startsAt:string;id:string}|null)=>{const {rows}=await deps.pool.query<Candidate>(`SELECT m.*,m.starts_at::text AS cursor_starts_at,COALESCE(c.classification,'regular') AS statistics_class FROM meals m LEFT JOIN LATERAL(SELECT classification FROM account_classifications WHERE user_id=m.host_id ORDER BY revision DESC LIMIT 1)c ON true WHERE m.status='OPEN' AND ($1::timestamptz IS NULL OR (m.starts_at,m.id)>($1::timestamptz,$2::uuid)) ORDER BY m.starts_at,m.id LIMIT 500`,[after?.startsAt??null,after?.id??null]);return rows;};
  // Provider display is request-local only, shared by page and independent analytics scans.
  const places=new Map<string,ReturnType<VenueService['details']>>();
  const requestVenues=new Proxy(venues,{get(target,key,receiver){if(key==='details')return(placeId:string)=>{let result=places.get(placeId);if(!result){result=target.details(placeId);places.set(placeId,result);}return result;};return Reflect.get(target,key,receiver);}});
  const {rows:[clock]}=await deps.pool.query<{now:Date}>(`SELECT clock_timestamp() AS now`);const now=clock!.now;
  const eligible=(meal:Candidate,dto:Awaited<ReturnType<typeof mealDto>>)=>meal.statistics_class==='regular'&&(auth?dto.allowedActions.includes('APPLY'):now<meal.closes_at&&now<meal.starts_at&&dto.confirmedCount<dto.capacity);
  async function matching(meal:Candidate,display:boolean){
   if(split('dates').length&&!split('dates').includes(meal.start_local_date))return null;
   if(q.timeOfDay==='lunch'&&Number(meal.start_local_time.slice(0,2))>=16)return null;if(q.timeOfDay==='dinner'&&Number(meal.start_local_time.slice(0,2))<16)return null;
   if(split('areaCodes').length&&!split('areaCodes').includes(meal.area_code))return null;
   if(q.budgetMaxPence!==undefined&&meal.budget_max_pence>Number(q.budgetMaxPence))return null;
   if(split('tableSizes').length&&!split('tableSizes').includes(String(meal.capacity)))return null;
   if(split('languages').length&&!meal.languages.some(l=>split('languages').includes(l)))return null;
   if(split('moods').length&&!split('moods').includes(meal.mood))return null;
   if(split('cuisineCodes').length&&(!meal.cuisine_code||!split('cuisineCodes').includes(meal.cuisine_code)))return null;
   if(split('dietaryCodes').length&&!meal.dietary_codes?.some(d=>split('dietaryCodes').includes(d)))return null;
   let dto=await mealDto(deps.pool,meal,now,requestVenues,auth?.userId??null,false);
   if(dto.status!=='OPEN')return null;
   if(display||typeof q.keyword==='string'||bounds!==undefined)dto=await mealDto(deps.pool,meal,now,requestVenues,auth?.userId??null,true);
   if(typeof q.keyword==='string'&&![meal.title,meal.description,dto.venue.name??''].some(s=>s.toLowerCase().includes((q.keyword as string).trim().toLowerCase())))return null;
   const loc=dto.venue.location;if(bounds&&(!loc||loc.lat>bounds.north||loc.lat<bounds.south||(bounds.west<=bounds.east?loc.lng<bounds.west||loc.lng>bounds.east:loc.lng<bounds.west&&loc.lng>bounds.east)))return null;
   return dto;
  }
  const data:Awaited<ReturnType<typeof mealDto>>[]=[];const eligiblePageIds:string[]=[];let last:Candidate|undefined;let scanned=0;
  try{
   const rows=await readBatch(cursor);
   for(const meal of rows){
    last=meal;scanned++;
    const dto=await matching(meal,true);if(!dto)continue;
    data.push(dto);if(eligible(meal,dto))eligiblePageIds.push(meal.id);
    if(data.length===limit)break;
   }
   // Never inspect row 501. A full scan conservatively exposes a continuation even
   // when the next request will discover the physical end of the candidate set.
   const hasMore=scanned<rows.length||rows.length===500;
   if(capture)try{
    let eligibleCount=0;let after:null|{startsAt:string;id:string}=null;
    // This independent aggregate must not consume the page's scan budget or cursor.
    for(;;){const batch=await readBatch(after);for(const meal of batch){const dto=await matching(meal,false);if(dto&&eligible(meal,dto))eligibleCount++;}if(batch.length<500)break;const tail=batch.at(-1)!;after={startsAt:tail.cursor_starts_at,id:tail.id};}
    await recordDiscoveryOutcome(deps,{request,auth,params:q,resultCount:eligibleCount,resultMealIds:data.map(m=>m.id),eligibleMealIds:eligiblePageIds,outcome:'success'});
   }catch{request.log.warn({code:'ANALYTICS_DISCOVERY_UNAVAILABLE'},'discovery analytics recording unavailable');}
   return {data,page:{hasMore,nextCursor:hasMore&&last?codec.encode(Buffer.from(JSON.stringify({startsAt:last.cursor_starts_at,id:last.id})).toString('base64url')):null}};
  }catch(error){if(capture)try{await recordDiscoveryOutcome(deps,{request,auth,params:q,resultCount:0,resultMealIds:[],eligibleMealIds:[],outcome:'failed'});}catch{request.log.warn({code:'ANALYTICS_DISCOVERY_UNAVAILABLE'},'failed discovery analytics recording unavailable');}throw error;}
 });
 defineRoute(app,deps,'myMeals',async({request,auth})=>{
  const q=request.query as {section:string;cursor?:string;limit?:number};const limit=q.limit??20;const now=new Date();const codec=await cursorCodec(auth!.userId,'myMeals',q);
  const {rows}=await deps.pool.query<MealRow>(`SELECT m.* FROM meals m WHERE host_id=$1 OR EXISTS(SELECT 1 FROM applications a WHERE a.meal_id=m.id AND a.user_id=$1) ORDER BY starts_at,id`,[auth!.userId]);
  const items=[];
  for(const meal of rows){
   const {rows:apps}=await deps.pool.query(`SELECT * FROM applications WHERE meal_id=$1 AND user_id=$2 ORDER BY created_at DESC,round DESC`,[meal.id,auth!.userId]);
   const dto=await mealDto(deps.pool,meal,now,venues,auth!.userId);const mine=apps[0];const host=meal.host_id===auth!.userId;
   const roster=now>=meal.starts_at?rosterAt(await loadSeatEvents({client:deps.pool as unknown as import('pg').PoolClient},meal.id),meal.starts_at):[];
   const visible=q.section==='HOSTING'?host:q.section==='UPCOMING'?dto.status==='OPEN'&&now<meal.scheduled_end_at&&(host||mine?.state==='CONFIRMED'):q.section==='PAST'?dto.status!=='CANCELLED'&&now>=meal.scheduled_end_at&&roster.includes(auth!.userId):q.section==='CANCELLED'?dto.status==='CANCELLED'||mine?.state==='CANCELLED':apps.length>0;
   if(!visible)continue;
   const {rows:[conversation]}=await deps.pool.query(`SELECT c.id FROM conversations c WHERE c.meal_id=$1 AND EXISTS(SELECT 1 FROM membership_intervals i WHERE i.conversation_id=c.id AND i.user_id=$2)`,[meal.id,auth!.userId]);
   for(const row of q.section==='APPLICATIONS'?apps:[mine??null]) {
    const application=row?await applicationDto(deps.pool,{...row,...(row.state==='PENDING'&&now>=meal.closes_at?{state:'EXPIRED'}:{})},true):null;
    const key=q.section==='APPLICATIONS'?{startsAt:row!.created_at.toISOString(),id:row!.id}:{startsAt:meal.starts_at.toISOString(),id:meal.id};
    items.push({key,data:{meal:dto,application,role:host?'HOST':row?.state==='CONFIRMED'?'GUEST':'APPLICANT',conversationId:conversation?.id??null}});
   }
  }
  const descending=q.section==='APPLICATIONS';
  items.sort((a,b)=>(a.key.startsAt.localeCompare(b.key.startsAt)||a.key.id.localeCompare(b.key.id))*(descending?-1:1));
  const cursor=parseCursor(q.cursor?codec.decode(q.cursor):undefined);const selected=items.filter(item=>!cursor||(item.key.startsAt.localeCompare(cursor.startsAt)||item.key.id.localeCompare(cursor.id))*(descending?-1:1)>0);
  const page=selected.slice(0,limit);const hasMore=selected.length>limit;const last=page.at(-1);
  return {data:page.map(i=>i.data),page:{hasMore,nextCursor:hasMore&&last?codec.encode(Buffer.from(JSON.stringify(last.key)).toString('base64url')):null}};
 });
}
