import type { Pool,PoolClient } from 'pg';
import type { Preferences } from '../../../../packages/assistant/src/index.ts';
import { AssistantError } from '../../../../packages/assistant/src/index.ts';

/** Explicit public projection only. No message, review, reconnect, survey, report or admin joins. */
export interface Candidate {
  id:string;version:string;title:string;description:string;venueRef:string;startsAt:string;budgetMaxPence:number;capacity:number;
  area:string;languages:string[];mood:string;dietaryCodes:string[];cuisineCode?:string|null;localDate?:string;localTime?:string;
}
export interface Bounds {north:number;south:number;east:number;west:number}
export type VenueDisplay=(venueRef:string)=>Promise<{name:string;location:{lat:number;lng:number}}>;
export type HardFilters=Partial<Preferences>&{dates?:string[];cuisineCodes?:string[];tonight?:boolean;keyword?:string;timeOfDay?:'lunch'|'dinner';bounds?:Bounds};
const londonHour=(instant:string)=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(new Date(instant)));
export function validatePublicFilters(hard:HardFilters):void {
  if(hard.keyword!==undefined&&(typeof hard.keyword!=='string'||hard.keyword.length>120))throw new AssistantError('AI_CONFLICT');
  if(hard.timeOfDay!==undefined&&!['lunch','dinner'].includes(hard.timeOfDay))throw new AssistantError('AI_CONFLICT');
  const b=hard.bounds;
  if(b&&(![b.north,b.south,b.east,b.west].every(Number.isFinite)||b.north>90||b.south< -90||b.north<b.south||Math.abs(b.east)>180||Math.abs(b.west)>180))throw new AssistantError('AI_CONFLICT');
}
/** Only public provider metadata in request RAM. Missing geometry/provider fails the whole query. */
export async function filterPublicCandidates(candidates:Candidate[],hard:HardFilters,venueDisplay?:VenueDisplay):Promise<Candidate[]> {
  validatePublicFilters(hard);
  const keyword=hard.keyword?.trim().toLocaleLowerCase()??'';
  const displays=new Map<string,ReturnType<VenueDisplay>>();
  const read=(ref:string)=>{
    if(!venueDisplay)throw new AssistantError('AI_UNAVAILABLE');
    let display=displays.get(ref);if(!display){display=venueDisplay(ref);displays.set(ref,display);}return display;
  };
  const result:Candidate[]=[];
  for(const candidate of candidates){
    const textMatch=!keyword||`${candidate.title}\n${candidate.description}`.toLocaleLowerCase().includes(keyword);
    if(!hard.bounds&&textMatch){result.push(candidate);continue;}
    let display:Awaited<ReturnType<VenueDisplay>>;
    try{display=await read(candidate.venueRef);}catch{throw new AssistantError('AI_UNAVAILABLE');}
    if(typeof display?.name!=='string'||!display.location||!Number.isFinite(display.location.lat)||Math.abs(display.location.lat)>90||!Number.isFinite(display.location.lng)||Math.abs(display.location.lng)>180)throw new AssistantError('AI_UNAVAILABLE');
    if(keyword&&!textMatch&&!display.name.toLocaleLowerCase().includes(keyword))continue;
    const b=hard.bounds,p=display.location;
    if(b&&(p.lat<b.south||p.lat>b.north||(b.west<=b.east?(p.lng<b.west||p.lng>b.east):!(p.lng>=b.west||p.lng<=b.east))))continue;
    result.push(candidate);
  }
  return result;
}
export function rankCandidates(candidates:Candidate[],hard:HardFilters,preferences:Preferences,cleared:readonly (keyof Preferences)[]=[]):Candidate[]{
  validatePublicFilters(hard);
  const hits=(c:Candidate,key:keyof Preferences,value:unknown):boolean=>{
    if(key==='budgetMaxPence')return typeof value==='number'&&c.budgetMaxPence<=value;
    if(!Array.isArray(value)||value.length===0)return false;
    if(key==='areas')return value.includes(c.area);
    if(key==='tableSizes')return value.includes(c.capacity);
    if(key==='languages')return c.languages.some(x=>value.includes(x));
    if(key==='moods')return value.includes(c.mood);
    return c.dietaryCodes.some(x=>value.includes(x));
  };
  const fields=Object.keys(preferences) as (keyof Preferences)[];
  const filtered=candidates.filter(c=>(!hard.cuisineCodes?.length||!!c.cuisineCode&&hard.cuisineCodes.includes(c.cuisineCode))&&(!hard.tonight||!!c.localTime&&c.localTime>='18:00')&&(!hard.timeOfDay||(hard.timeOfDay==='lunch'?londonHour(c.startsAt)<16:londonHour(c.startsAt)>=16))&&fields.every(key=>{
    const value=hard[key];return cleared.includes(key)||value===undefined||value===null||(Array.isArray(value)&&value.length===0)||hits(c,key,value);
  }));
  const score=(c:Candidate)=>fields.filter(key=>!cleared.includes(key)&&hard[key]===undefined&&hits(c,key,preferences[key])).length;
  return filtered.sort((a,b)=>score(b)-score(a)||a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id));
}
export async function publicCandidates(pool:Pool|PoolClient,subject:string,dates?:readonly string[]):Promise<Candidate[]>{
  const user=subject.startsWith('user:')?subject.slice(5):null;
  // Eligibility is evaluated from the full candidate set before soft ranking/truncation. No
  // provider text or private application message is selected; only exclusions use application state.
  const {rows}=await pool.query(`SELECT m.id,m.version::text,m.title,m.description,m.venue_ref,m.starts_at,m.budget_max_pence,m.capacity,m.area_code,m.languages,m.mood,m.dietary_codes,m.cuisine_code,m.start_local_date,m.start_local_time
    FROM meals m JOIN users host ON host.id=m.host_id AND host.status='ACTIVE' WHERE m.status='OPEN' AND m.starts_at>clock_timestamp() AND m.closes_at>clock_timestamp()
    AND (($2::text[] IS NOT NULL AND m.start_local_date=ANY($2::text[])) OR ($2::text[] IS NULL AND m.start_local_date >= to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') AND m.start_local_date < to_char((clock_timestamp() AT TIME ZONE 'Europe/London')+interval '7 days','YYYY-MM-DD')))
    AND ($1::uuid IS NULL OR m.host_id<>$1)
    AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.meal_id=m.id AND a.user_id=$1 AND a.state IN ('PENDING','CONFIRMED','DECLINED'))
    AND m.capacity>1+(SELECT count(*) FROM applications a WHERE a.meal_id=m.id AND a.state='CONFIRMED') ORDER BY m.starts_at,m.id`,[user,dates?.length?dates:null]);
  return rows.map(r=>({id:r.id,version:r.version,title:r.title,description:r.description,venueRef:r.venue_ref,startsAt:(r.starts_at as Date).toISOString(),budgetMaxPence:r.budget_max_pence,capacity:r.capacity,area:r.area_code,languages:r.languages,mood:r.mood,dietaryCodes:r.dietary_codes??[],cuisineCode:r.cuisine_code,localDate:r.start_local_date,localTime:r.start_local_time}));
}

export interface PublicFacts {id:string;version:string;title:string;status:string;startsAt:string;closesAt:string;budgetMaxPence:number;capacity:number}
export async function publicFacts(db:Pool|PoolClient,ids:readonly string[]):Promise<PublicFacts[]>{
  if(ids.length>3)return [];
  const {rows}=await db.query(`SELECT m.id,m.version::text,m.title,m.status,m.starts_at,m.closes_at,m.budget_max_pence,m.capacity FROM meals m JOIN users host ON host.id=m.host_id AND host.status='ACTIVE' WHERE m.id=ANY($1::uuid[]) ORDER BY m.id`,[ids]);
  return rows.map(r=>({id:r.id,version:r.version,title:r.title,status:r.status,startsAt:(r.starts_at as Date).toISOString(),closesAt:(r.closes_at as Date).toISOString(),budgetMaxPence:r.budget_max_pence,capacity:r.capacity}));
}
