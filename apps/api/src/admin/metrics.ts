import { ADMIN_PAGE_KEYS, type ADMIN_PAGES } from '@fancy/contracts';
export type Page=(typeof ADMIN_PAGES)[number];
export interface Filters {from:string|null;to:string|null;areas:string[];languages:string[];budgetBands:string[];sizes:string[];sources:string[];segments:string[];budgetUpToPence:number|null}
export interface Meal {id:string;host_id:string;starts_at:string;closes_at:string;scheduled_end_at:string;minimum:number;capacity:number;budget_max_pence:number;languages:string[];area_code:string;status:string;cancel_reason:string|null;created_at:string;attempt_id?:string}
export interface Application {id:string;meal_id:string;user_id:string;state:string;created_at:string;decided_at:string|null}
export interface Seat {meal_id:string;seq:string;user_id:string;application_id:string|null;type:string;effective_at:string}
export interface AttendanceRevision {meal_id:string;subject_id:string;source:'SELF'|'HOST'|'SUPPORT';value:'present'|'absent';version:string;created_at:string;actor_id:string}
export interface Experience {meal_id:string;user_id:string;score:number;revision:string;created_at:string}
export interface User {id:string;created_at:string}
export interface Survey {user_id:string;version:string;again:boolean|null;reasons:string[];submitted_at:string}
export interface Event {event_id:string;anonymous_id:string;user_id:string|null;session_id:string;type:string;occurred_at:string;received_at:string;properties:Record<string,unknown>}
export interface Delivery {id:string;event_id:string|null;outcome:string;reason:string|null;received_at:string}
export interface Facts {users:User[];meals:Meal[];applications:Application[];seats:Seat[];surveys:Survey[];events:Event[];attendance?:AttendanceRevision[];experiences?:Experience[];quality?:{excludedEvents?:number;deliveryComplete?:boolean};excludedEvents?:Array<{event_id:string;type:string;occurred_at:string;reason:string}>;deliveries?:Delivery[];historyCoverageStart?:string;discoveryReady?:boolean;telemetryReady?:boolean}
export interface Row {rowId:string;inNumerator:boolean;inDenominator:boolean;attributes:Record<string,string|number|boolean|null>}
type Value=number|null|{numerator:number;denominator:number};
const DAY=86400000;
const at=(iso:string)=>Date.parse(iso);
export const londonDay=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
function week(iso:string){const d=new Date(londonDay(iso)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
const byVersion=(a:{version:string},b:{version:string})=>BigInt(a.version)<BigInt(b.version)?-1:BigInt(a.version)>BigInt(b.version)?1:0;
const nearest=(values:number[],p:number)=>values.length?[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]!:null;
const row=(id:string,attrs:Row['attributes'],n=true,d=true):Row=>({rowId:id,inNumerator:n,inDenominator:d,attributes:attrs});

/** Pure measurement-v4 calculation over one sealed, minimal, server-owned fact set. */
export function calculateMetrics(facts:Facts,filters:Filters,asOfIso:string){
 const asOf=at(asOfIso);const users=new Map(facts.users.map(u=>[u.id,u]));const meals=new Map(facts.meals.map(m=>[m.id,m]));
 const dates=(iso:string)=>{const day=londonDay(iso);return(!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to);};
 const segment=(id:string)=>{if(!filters.segments.length)return true;const joined=users.get(id);if(!joined)return false;const date=londonDay(joined.created_at);const kind=filters.from&&date<filters.from?'existing':dates(joined.created_at)?'new':null;return kind!==null&&filters.segments.includes(kind);};
 const fits=(m:Meal)=>{const band=m.budget_max_pence<=2000?'0-20':m.budget_max_pence<=3000?'20-30':m.budget_max_pence<=4000?'30-40':'40+';return(!filters.areas.length||filters.areas.includes(m.area_code))&&(!filters.languages.length||filters.languages.some(l=>m.languages.includes(l)))&&(!filters.sizes.length||filters.sizes.includes(m.capacity>=7?'7+':String(m.capacity)))&&(!filters.budgetBands.length||filters.budgetBands.includes(band))&&(!filters.budgetUpToPence||m.budget_max_pence<=filters.budgetUpToPence);};
 const attrs=(m:Meal)=>({mealId:m.id,startsAt:m.starts_at,area:m.area_code,status:m.status});
 const rows:Record<string,Row[]>={};const metrics:Record<string,Value>=Object.fromEntries([...new Set(Object.values(ADMIN_PAGE_KEYS).flatMap(p=>[...p.metrics]))].map(k=>[k,null]));
 const series:Record<string,Array<{key:string;value:Value}>>={};
 const ratio=(key:string,items:Row[])=>{rows[key]=items;metrics[key]={numerator:items.filter(r=>r.inNumerator&&r.inDenominator).length,denominator:items.filter(r=>r.inDenominator).length};};
 const count=(key:string,items:Row[])=>{rows[key]=items;metrics[key]=items.filter(r=>r.inNumerator).length;};
 const orderedSeats=[...facts.seats].sort((a,b)=>a.meal_id.localeCompare(b.meal_id)||(at(a.effective_at)-at(b.effective_at))||(BigInt(a.seq)<BigInt(b.seq)?-1:1));
 const latestSeats=new Map<string,Seat>();
 for(const seat of orderedSeats){const meal=meals.get(seat.meal_id);if(meal&&(seat.type==='LEFT'?at(seat.effective_at)<=at(meal.starts_at):at(seat.effective_at)<at(meal.starts_at)))latestSeats.set(seat.meal_id+':'+seat.user_id,seat);}
 const roster=[...latestSeats.values()].filter(s=>s.type!=='LEFT');
 const sourceReady=facts.attendance!==undefined;
 type Part={meal:Meal;userId:string;applicationId:string|null;value:'present'|'absent'|'unknown';source:string|null;difference:boolean};
 const parts:Part[]=[];
 if(sourceReady)for(const seat of roster){const meal=meals.get(seat.meal_id)!;if(meal.status==='CANCELLED'||at(meal.scheduled_end_at)>asOf)continue;
  const latest=new Map<string,AttendanceRevision>();
  for(const revision of [...(facts.attendance??[])].filter(r=>r.meal_id===meal.id&&r.subject_id===seat.user_id&&at(r.created_at)<=asOf).sort(byVersion)){
   const submitted=at(revision.created_at),end=at(meal.scheduled_end_at);
   if(revision.source==='SUPPORT'?submitted<end+7*DAY:submitted<end||submitted>=end+7*DAY)continue;
   if(revision.source==='SELF'&&revision.actor_id!==seat.user_id||revision.source==='HOST'&&revision.actor_id!==meal.host_id)continue;
   latest.set(revision.source,revision);
  }
  const effective=latest.get('SUPPORT')??latest.get('SELF')??latest.get('HOST');
  parts.push({meal,userId:seat.user_id,applicationId:seat.application_id,value:effective?.value??'unknown',source:effective?.source??null,difference:!!latest.get('SELF')&&!!latest.get('HOST')&&latest.get('SELF')!.value!==latest.get('HOST')!.value});
 }
 const selectedParts=parts.filter(p=>fits(p.meal)&&dates(p.meal.starts_at)&&segment(p.userId));
 const partRows=selectedParts.map(p=>row(p.meal.id+':'+p.userId,{...attrs(p.meal),userId:p.userId,attendanceStatus:p.value,source:p.source,sourceDifference:p.difference},p.value!=='unknown'));
 rows.attendance=partRows;
 if(sourceReady){
  ratio('coverage',partRows);
  count('weekly',[...new Map(selectedParts.filter(p=>p.value==='present').map(p=>[p.userId,row(p.userId,{userId:p.userId})])).values()]);
  const weeks=new Map<string,Set<string>>();for(const p of selectedParts.filter(p=>p.value==='present')){const key=week(p.meal.starts_at);if(!weeks.has(key))weeks.set(key,new Set());weeks.get(key)!.add(p.userId);}series['weekly.trend']=[...weeks].sort(([a],[b])=>a.localeCompare(b)).map(([key,set])=>({key,value:set.size}));
  series['attendance.distribution']=['present','absent','unknown'].map(key=>({key,value:selectedParts.filter(p=>p.value===key).length}));
  const attendedMealIds=new Set(selectedParts.filter(p=>p.value==='present').map(p=>p.meal.id));count('mealsWithAttendance',facts.meals.filter(m=>attendedMealIds.has(m.id)).map(m=>row(m.id,attrs(m))));
 }
 const present=parts.filter(p=>p.value==='present').sort((a,b)=>at(a.meal.starts_at)-at(b.meal.starts_at)||a.meal.id.localeCompare(b.meal.id));
 const firstAttendance=new Map<string,Part>();for(const p of present)if(!firstAttendance.has(p.userId))firstAttendance.set(p.userId,p);
 const firstApplication=new Map<string,Application>();for(const a of [...facts.applications].sort((a,b)=>at(a.created_at)-at(b.created_at)||a.id.localeCompare(b.id)))if(!firstApplication.has(a.user_id))firstApplication.set(a.user_id,a);
 if(sourceReady){
  const activation:Row[]=[];
  for(const [id,a]of firstApplication){const meal=meals.get(a.meal_id);if(!meal||!fits(meal)||!dates(a.created_at)||!segment(id))continue;const first=firstAttendance.get(id);const mature=at(a.created_at)+14*DAY<=asOf;const converted=!!first&&at(first.meal.starts_at)>=at(a.created_at)&&at(first.meal.starts_at)<=at(a.created_at)+14*DAY;activation.push(row(id,{userId:id,mealId:a.meal_id,firstAppliedAt:a.created_at,firstAttendedAt:first?.meal.starts_at??null,observation:mature?'mature':'observing',historyIncomplete:!!facts.historyCoverageStart&&at(users.get(id)?.created_at??facts.historyCoverageStart)<at(facts.historyCoverageStart)},mature&&converted,mature));}
  ratio('activation',activation);
  const retention:Row[]=[];
  for(const [id,first]of firstAttendance){if(!fits(first.meal)||!dates(first.meal.starts_at)||!segment(id))continue;const initial=at(first.meal.starts_at),mature=initial+30*DAY<=asOf;const repeated=present.some(p=>p.userId===id&&p.meal.id!==first.meal.id&&at(p.meal.starts_at)>initial&&at(p.meal.starts_at)<=initial+30*DAY);retention.push(row(id,{userId:id,mealId:first.meal.id,firstAttendedAt:first.meal.starts_at,cohortWeek:week(first.meal.starts_at),observation:mature?'mature':'observing',historyIncomplete:!!facts.historyCoverageStart&&at(users.get(id)?.created_at??facts.historyCoverageStart)<at(facts.historyCoverageStart)},mature&&repeated,mature));}
  ratio('retention',retention);rows['cohort.users']=retention;
  series['cohort.retention']=[...new Set(retention.map(r=>String(r.attributes.cohortWeek)))].sort().map(key=>{const cohort=retention.filter(r=>r.attributes.cohortWeek===key);return{key,value:{numerator:cohort.filter(r=>r.inNumerator).length,denominator:cohort.filter(r=>r.inDenominator).length}};});
 }
 const selectedApplications=facts.applications.filter(a=>{const meal=meals.get(a.meal_id);return !!meal&&fits(meal)&&dates(a.created_at)&&segment(a.user_id);});
 const confirmed=new Map<string,Seat>();for(const s of orderedSeats)if(s.type==='GUEST_CONFIRMED'&&s.application_id&&!confirmed.has(s.application_id))confirmed.set(s.application_id,s);
 const applicationRows=selectedApplications.map(a=>{const meal=meals.get(a.meal_id)!;const decision=confirmed.get(a.id)?.effective_at??(a.state==='DECLINED'?a.decided_at:null);const decisionHours=decision&&at(decision)>=at(a.created_at)&&at(decision)<=asOf?(at(decision)-at(a.created_at))/3600000:null;const pending=a.state==='PENDING'&&meal.status!=='CANCELLED'&&asOf<at(meal.closes_at);return row(a.id,{...attrs(meal),userId:a.user_id,applicationId:a.id,appliedAt:a.created_at,status:a.state==='PENDING'&&!pending?'EXPIRED':a.state,decisionHours,pendingWaitHours:pending?Math.max(0,(asOf-at(a.created_at))/3600000):null});});
 count('applications',applicationRows);rows.applications=applicationRows;
 count('confirmed',applicationRows.map(r=>({...r,inNumerator:confirmed.has(r.rowId)})));
 count('approved',rows.confirmed!);
 metrics.approval=nearest(applicationRows.map(r=>r.attributes.decisionHours).filter((v):v is number=>typeof v==='number'),.9);rows.approval=applicationRows;
 metrics.approvalP50=nearest(applicationRows.map(r=>r.attributes.decisionHours).filter((v):v is number=>typeof v==='number'),.5);rows.approvalP50=applicationRows;
 count('pendingApplications',applicationRows.filter(r=>typeof r.attributes.pendingWaitHours==='number'));
 const pendingHours=rows.pendingApplications!.map(r=>Number(r.attributes.pendingWaitHours));metrics.oldestPendingHours=pendingHours.length?Math.max(...pendingHours):null;rows.oldestPendingHours=rows.pendingApplications!;
 if(sourceReady){const successful=new Set(parts.filter(p=>p.value==='present'&&p.applicationId).map(p=>p.applicationId));ratio('applicationAttendance',selectedApplications.map(a=>{const m=meals.get(a.meal_id)!;const mature=at(m.scheduled_end_at)+DAY<=asOf;return row(a.id,{...attrs(m),userId:a.user_id,applicationId:a.id,appliedAt:a.created_at,observation:mature?'mature':'observing'},mature&&successful.has(a.id),mature);}));}
 const started=facts.meals.filter(m=>fits(m)&&dates(m.starts_at)&&at(m.starts_at)<=asOf);
 const formation=started.map(m=>{let peak=0;const active=new Set<string>();for(const s of orderedSeats.filter(s=>s.meal_id===m.id&&at(s.effective_at)<at(m.starts_at))){if(s.type==='LEFT')active.delete(s.user_id);else active.add(s.user_id);peak=Math.max(peak,active.size);}return row(m.id,{...attrs(m),minimum:m.minimum,peakConfirmed:peak},peak>=m.minimum);});
 ratio('formation',formation);ratio('cancellation',started.map(m=>row(m.id,{...attrs(m),reason:m.cancel_reason??'unknown'},m.status==='CANCELLED')));rows.meals=started.map(m=>row(m.id,attrs(m)));
 series['cancellation.reasons']=['host','booking','other','insufficient','unknown'].map(key=>({key,value:started.filter(m=>m.status==='CANCELLED'&&(m.cancel_reason??'unknown')===key).length}));
 series['area.compare']=[...new Set(started.map(m=>m.area_code))].sort().map(key=>{const items=formation.filter(r=>r.attributes.area===key);return{key,value:{numerator:items.filter(r=>r.inNumerator).length,denominator:items.length}};});
 if(sourceReady&&facts.experiences!==undefined){
  const latest=new Map<string,Experience>();for(const e of [...facts.experiences].sort((a,b)=>BigInt(a.revision)<BigInt(b.revision)?-1:1)){const meal=meals.get(e.meal_id);if(!meal||at(e.created_at)>asOf||at(e.created_at)<at(meal.scheduled_end_at)||at(e.created_at)>=at(meal.scheduled_end_at)+7*DAY||!Number.isInteger(e.score)||e.score<1||e.score>5)continue;latest.set(e.meal_id+':'+e.user_id,e);}
  const eligible=selectedParts.filter(p=>p.value==='present');
  ratio('feedback',eligible.map(p=>{const e=latest.get(p.meal.id+':'+p.userId);return row(p.meal.id+':'+p.userId,{...attrs(p.meal),userId:p.userId,score:e?.score??null},!!e);}));
  series['rating.distribution']=[1,2,3,4,5].map(score=>({key:String(score),value:rows.feedback!.filter(r=>r.attributes.score===score).length}));
 }
 const latestSurveys=new Map<string,Survey>();for(const s of [...facts.surveys].filter(s=>at(s.submitted_at)<=asOf).sort(byVersion))latestSurveys.set(s.user_id,s);
 const surveys=[...latestSurveys.values()].filter(s=>dates(s.submitted_at)&&segment(s.user_id));
 ratio('survey',surveys.map(s=>row(s.user_id,{userId:s.user_id,submittedAt:s.submitted_at,again:s.again,surveyScope:'date_and_user_segment',...Object.fromEntries(['company','conversation','coordination','expectations','venue','cost','other'].map(f=>['factor'+f.charAt(0).toUpperCase()+f.slice(1),s.reasons.includes(f)]))},s.again===true,s.again!==null)));
 series['survey.reasons']=['company','conversation','coordination','expectations','venue','cost','other','none'].map(key=>({key,value:surveys.filter(s=>key==='none'?!s.reasons.length:s.reasons.includes(key)).length}));
 rows['quality.events']=facts.events.map(e=>row(e.event_id,{eventId:e.event_id,userId:e.user_id,type:e.type,occurredAt:e.occurred_at,receivedAt:e.received_at,receiveLatencySeconds:Math.max(0,(at(e.received_at)-at(e.occurred_at))/1000)}));
 metrics.receiveLatencyP90=nearest(rows['quality.events'].map(r=>Number(r.attributes.receiveLatencySeconds)),.9);rows.receiveLatencyP90=rows['quality.events'];
 if(facts.quality?.excludedEvents!==undefined)metrics.excluded=facts.quality.excludedEvents;
 if(facts.excludedEvents!==undefined)rows.excluded=facts.excludedEvents.map(e=>row(e.event_id,{eventId:e.event_id,type:e.type,occurredAt:e.occurred_at,reason:e.reason}));
 if(facts.quality?.deliveryComplete&&facts.deliveries!==undefined){
  const deliveryRows=facts.deliveries.map(d=>row(d.id,{eventId:d.event_id,outcome:d.outcome,reason:d.reason,receivedAt:d.received_at}));
  count('missingRequired',deliveryRows.filter(r=>r.attributes.reason==='missing_required'));
  count('duplicates',deliveryRows.filter(r=>r.attributes.outcome==='duplicate'));
  rows['quality.events']=deliveryRows;
 }
 const matchesEvent=(e:Event)=>{
  if(!dates(e.occurred_at)||e.user_id&&!segment(e.user_id)||!e.user_id&&filters.segments.length)return false;
  const p=e.properties.filters;
  const requestFilters=p&&typeof p==='object'?p as Record<string,unknown>:null;
  if(!requestFilters){const m=typeof e.properties.mealId==='string'?meals.get(e.properties.mealId):null;return m?fits(m):!filters.areas.length&&!filters.languages.length&&!filters.budgetBands.length&&!filters.sizes.length&&!filters.budgetUpToPence;}
  const values=(key:string)=>typeof requestFilters[key]==='string'?String(requestFilters[key]).split(','):[];
  const budget=typeof requestFilters.budgetMaxPence==='number'?requestFilters.budgetMaxPence:null;
  const band=budget===null?'unknown':budget<=2000?'0-20':budget<=3000?'20-30':budget<=4000?'30-40':'40+';
  return(!filters.areas.length||filters.areas.some(a=>values('areaCodes').includes(a)))&&(!filters.languages.length||filters.languages.some(l=>values('languages').includes(l)))&&(!filters.sizes.length||filters.sizes.some(s=>values('tableSizes').includes(s)))&&(!filters.budgetBands.length||filters.budgetBands.includes(band))&&(!filters.budgetUpToPence||budget!==null&&budget<=filters.budgetUpToPence);
 };
 const events=facts.events.filter(matchesEvent);
 if(facts.discoveryReady){
  const valid=events.filter(e=>e.type==='discovery_results'&&e.properties.serverOnly===true&&Number.isInteger(e.properties.resultCount)&&Number(e.properties.resultCount)>=0);
  ratio('discovery',valid.map(e=>row(e.event_id,{eventId:e.event_id,userId:e.user_id,occurredAt:e.occurred_at,resultCount:Number(e.properties.resultCount)},e.properties.resultCount===0)));
 }
 if(facts.telemetryReady){
  const rendered=events.filter(e=>e.type==='discovery_results'&&e.properties.rendered===true);
  const impressions=events.filter(e=>e.type==='meal_impression');
  const details=events.filter(e=>e.type==='detail_view');
  const identity=(e:Event)=>e.user_id??'anonymous:'+e.anonymous_id;
  series['browse.people']=[['loaded',rendered],['impression',impressions],['detail',details]].map(([key,collection])=>({key:String(key),value:new Set((collection as Event[]).map(identity)).size}));
  series['features.usage']=['map_opened','filter_applied','profile_view','chat_opened'].map(key=>({key,value:new Set(events.filter(e=>e.type===key).map(identity)).size}));
  const cohort=(collection:Event[],inverse:boolean)=>{
   const groups=new Map<string,Event[]>();for(const e of collection.filter(e=>e.user_id)){if(!groups.has(e.user_id!))groups.set(e.user_id!,[]);groups.get(e.user_id!)!.push(e);}
   return[...groups].map(([userId,views])=>{const mature=views.filter(e=>at(e.occurred_at)+7*DAY<=asOf);const converted=mature.some(e=>facts.applications.some(a=>a.user_id===userId&&at(a.created_at)>=at(e.occurred_at)&&at(a.created_at)<=at(e.occurred_at)+7*DAY));return row(userId,{userId,observation:mature.length?'mature':'observing',firstObservedAt:views.reduce((first,e)=>at(e.occurred_at)<at(first)?e.occurred_at:first,views[0]!.occurred_at)},!!mature.length&&(inverse?!converted:converted),!!mature.length);});
  };
  if(facts.discoveryReady)ratio('discovery7',cohort(rendered,false));
  ratio('impressionNoApply',cohort(impressions,true));
  if(sourceReady){const opportunity=(rows.retention??[]).filter(r=>r.inDenominator).map(r=>({...r,inNumerator:facts.events.some(e=>e.type==='meal_impression'&&e.user_id===r.attributes.userId&&typeof e.properties.mealId==='string'&&meals.has(e.properties.mealId)&&e.properties.mealId!==r.attributes.mealId&&at(meals.get(e.properties.mealId)!.starts_at)>at(e.occurred_at)&&at(e.occurred_at)>at(String(r.attributes.firstAttendedAt))&&at(e.occurred_at)<=at(String(r.attributes.firstAttendedAt))+30*DAY)}));ratio('laterOpportunity',opportunity);}
  // Join/host funnels share the application/seat counts and create attempt chains.
  series['funnel.join']=[{key:'applications',value:Number(metrics.applications)},{key:'approved',value:Number(metrics.approved)},{key:'confirmed',value:Number(metrics.confirmed)},{key:'attended',value:sourceReady?rows.applicationAttendance!.filter(r=>r.inNumerator).length:null}];
  const starts=facts.events.filter(e=>e.type==='create_started'&&typeof e.properties.attemptId==='string').sort((a,b)=>at(a.occurred_at)-at(b.occurred_at));const seen=new Set<string>();let arranged=0,published=0,started=0;
  for(const start of starts){const key=identity(start)+':'+String(start.properties.attemptId);if(seen.has(key))continue;seen.add(key);if(!matchesEvent(start))continue;started++;const next=facts.events.filter(e=>e.type==='create_arranged'&&identity(e)===identity(start)&&e.properties.attemptId===start.properties.attemptId&&at(e.occurred_at)>=at(start.occurred_at)).sort((a,b)=>at(a.occurred_at)-at(b.occurred_at))[0];if(next){arranged++;if(facts.meals.some(m=>m.host_id===start.user_id&&m.attempt_id===start.properties.attemptId&&at(m.created_at)>=at(next.occurred_at)))published++;}}
  series['funnel.create']=[{key:'started',value:started},{key:'arranged',value:arranged},{key:'published',value:published}];
 }
 const summaries=Object.fromEntries((Object.keys(ADMIN_PAGE_KEYS) as Page[]).map(page=>[page,{metrics:Object.fromEntries(ADMIN_PAGE_KEYS[page].metrics.map(k=>[k,metrics[k]??null])),series:Object.fromEntries(ADMIN_PAGE_KEYS[page].series.filter(k=>k in series).map(k=>[k,series[k]!]))}])) as Record<Page,{metrics:Record<string,Value>;series:Record<string,Array<{key:string;value:Value}>>}>;
 return{metrics,series,rows,summaries};
}
