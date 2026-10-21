import type { Pool,PoolClient } from 'pg';
import type { Preferences } from '../../../../packages/assistant/src/index.ts';

/** Explicit public projection only. No message, review, reconnect, survey, report or admin joins. */
export interface Candidate {
  id:string;version:string;title:string;startsAt:string;budgetMaxPence:number;capacity:number;
  area:string;languages:string[];mood:string;dietaryCodes:string[];cuisineCode?:string|null;localDate?:string;localTime?:string;
}
export type HardFilters=Partial<Preferences>&{dates?:string[];cuisineCodes?:string[];tonight?:boolean};
export function rankCandidates(candidates:Candidate[],hard:HardFilters,preferences:Preferences,cleared:readonly (keyof Preferences)[]=[]):Candidate[]{
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
  const filtered=candidates.filter(c=>(!hard.cuisineCodes?.length||!!c.cuisineCode&&hard.cuisineCodes.includes(c.cuisineCode))&&(!hard.tonight||!!c.localTime&&c.localTime>='18:00')&&fields.every(key=>{
    const value=hard[key];return cleared.includes(key)||value===undefined||value===null||(Array.isArray(value)&&value.length===0)||hits(c,key,value);
  }));
  const score=(c:Candidate)=>fields.filter(key=>!cleared.includes(key)&&hard[key]===undefined&&hits(c,key,preferences[key])).length;
  return filtered.sort((a,b)=>score(b)-score(a)||a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id));
}
export async function publicCandidates(pool:Pool|PoolClient,subject:string,dates?:readonly string[]):Promise<Candidate[]>{
  const user=subject.startsWith('user:')?subject.slice(5):null;
  // Eligibility is evaluated from the full candidate set before soft ranking/truncation. No
  // provider text or private application message is selected; only exclusions use application state.
  const {rows}=await pool.query(`SELECT m.id,m.version::text,m.title,m.starts_at,m.budget_max_pence,m.capacity,m.area_code,m.languages,m.mood,m.dietary_codes,m.cuisine_code,m.start_local_date,m.start_local_time
    FROM meals m WHERE m.status='OPEN' AND m.starts_at>clock_timestamp() AND m.closes_at>clock_timestamp()
    AND (($2::text[] IS NOT NULL AND m.start_local_date=ANY($2::text[])) OR ($2::text[] IS NULL AND m.start_local_date >= to_char(clock_timestamp() AT TIME ZONE 'Europe/London','YYYY-MM-DD') AND m.start_local_date < to_char((clock_timestamp() AT TIME ZONE 'Europe/London')+interval '7 days','YYYY-MM-DD')))
    AND ($1::uuid IS NULL OR m.host_id<>$1)
    AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.meal_id=m.id AND a.user_id=$1 AND a.state IN ('PENDING','CONFIRMED','DECLINED'))
    AND m.capacity>1+(SELECT count(*) FROM applications a WHERE a.meal_id=m.id AND a.state='CONFIRMED') ORDER BY m.starts_at,m.id`,[user,dates?.length?dates:null]);
  return rows.map(r=>({id:r.id,version:r.version,title:r.title,startsAt:(r.starts_at as Date).toISOString(),budgetMaxPence:r.budget_max_pence,capacity:r.capacity,area:r.area_code,languages:r.languages,mood:r.mood,dietaryCodes:r.dietary_codes??[],cuisineCode:r.cuisine_code,localDate:r.start_local_date,localTime:r.start_local_time}));
}

export interface PublicFacts {id:string;version:string;title:string;status:string;startsAt:string;closesAt:string;budgetMaxPence:number;capacity:number}
export async function publicFacts(db:Pool|PoolClient,ids:readonly string[]):Promise<PublicFacts[]>{
  if(ids.length>3)return [];
  const {rows}=await db.query(`SELECT id,version::text,title,status,starts_at,closes_at,budget_max_pence,capacity FROM meals WHERE id=ANY($1::uuid[]) ORDER BY id`,[ids]);
  return rows.map(r=>({id:r.id,version:r.version,title:r.title,status:r.status,startsAt:(r.starts_at as Date).toISOString(),closesAt:(r.closes_at as Date).toISOString(),budgetMaxPence:r.budget_max_pence,capacity:r.capacity}));
}
