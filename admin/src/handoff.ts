import type { Dataset } from "./analytics";
export const MAX_HANDOFF_BYTES = 512 * 1024;
export const CONTRACT_VERSION = "r1-1";
export type Handoff = { contractVersion: typeof CONTRACT_VERSION; demo: true; asOf: string; data: Dataset };
type Row = Record<string, unknown>;
const fail = (path: string): never => { throw new Error(`Invalid demo handoff: ${path}`); };
function obj(value: unknown, allowed: string[], path: string): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${path}.${key}: field not allowed`);
  return value as Row;
}
function str(row: Row, key: string, max = 200) {
  const value = row[key];
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(key);
  return value as string;
}
function id(row: Row, key = "id") { const value = str(row,key,80); if (!/^[A-Za-z0-9:_-]+$/.test(value)) fail(key); return value; }
function time(row: Row, key: string, optional = false) {
  if (optional && row[key] === undefined) return undefined;
  const value = str(row,key,40); if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,19) !== value.slice(0,19)) fail(key);
  const normalized=new Date(value).toISOString(); row[key]=normalized; return normalized;
}
function num(row: Row, key: string, min: number, max: number, integer = false) { const n=row[key]; if (typeof n !== "number" || !Number.isFinite(n) || n<min || n>max || (integer && !Number.isInteger(n))) fail(key); return n as number; }
function values(row: Row, key: string, allowed: string[], optional = false) {
  if (optional && row[key] === undefined) return;
  if (!allowed.includes(row[key] as string)) fail(key);
}
function rows(root: Row, key: string) { const a=root[key]; if (!Array.isArray(a) || a.length>5000) return fail(key); return a as unknown[]; }
function unique(set: Set<string>, key: string, path: string) { if(set.has(key)) fail(`${path}: duplicate ID`); set.add(key); }
export function parseHandoff(text: string): Handoff {
  if (new TextEncoder().encode(text).byteLength > MAX_HANDOFF_BYTES) fail("size exceeds 512 KiB");
  let parsed: unknown; try { parsed=JSON.parse(text); } catch { return fail("JSON"); }
  const top=obj(parsed,["contractVersion","demo","asOf","users","meals","applications","attendance","feedback","events"],"root");
  if (top.contractVersion !== CONTRACT_VERSION || top.demo !== true) fail("contractVersion/demo");
  const asOf=time(top,"asOf")!;
  const users=rows(top,"users"), meals=rows(top,"meals"), applications=rows(top,"applications"), attendance=rows(top,"attendance"), feedback=rows(top,"feedback"), events=rows(top,"events");
  // r1-1 handoff is authoritative business projection only; interaction events use the later SDK contract.
  if (events.length) fail("events must be empty in r1-1");
  const userIds=new Set<string>(),mealIds=new Set<string>(),appIds=new Set<string>();
  for(const value of users) { const r=obj(value,["id","joinedAt"],"user"); unique(userIds,id(r),"user"); if(time(r,"joinedAt")!>asOf) fail("user.joinedAt after cutoff"); }
  const mealMap=new Map<string,Row>();
  for(const value of meals) {
    const r=obj(value,["id","title","hostId","startsAt","endsAt","publishedAt","area","language","capacity","minimum","budget","source","cancelled","cancelReason","cancelReasons","cancelledAt","peakConfirmed","checkpoint","lowCountDecision"],"meal");
    const key=id(r); unique(mealIds,key,"meal"); if(!userIds.has(id(r,"hostId"))) fail("meal.hostId"); str(r,"title",120); str(r,"area",80); str(r,"language",80);
    const start=time(r,"startsAt")!,end=time(r,"endsAt")!,pub=time(r,"publishedAt")!;
    if(end<=start || pub>asOf || +new Date(pub)>+new Date(start)-60*60_000) fail("meal time order/publish cutoff");
    const cancelledAt=time(r,"cancelledAt",true); if(cancelledAt && (cancelledAt>asOf || cancelledAt<pub || !r.cancelled)) fail("cancelledAt");
    const cap=num(r,"capacity",2,6,true); if(r.minimum !== (cap===2 ? 2 : 3)) fail("minimum"); num(r,"budget",0,10000); num(r,"peakConfirmed",1,6,true);
    values(r,"source",["user","assisted"]); if(typeof r.cancelled!=="boolean") fail("cancelled");
    const reasons=["insufficient","booking","host","host_changed","other","unknown"];
    if(r.cancelReason!==undefined) values(r,"cancelReason",reasons);
    if(r.cancelReasons!==undefined && (!Array.isArray(r.cancelReasons) || r.cancelReasons.length>6 || r.cancelReasons.some((v)=>!reasons.includes(v)))) fail("cancelReasons");
    if(r.checkpoint!==undefined) {const c=obj(r.checkpoint,["at","passed","count"],"checkpoint");const at=time(c,"at")!;if(+new Date(at)!==+new Date(start)-15*60_000 || at>asOf || typeof c.passed!=="boolean") fail("checkpoint.at/passed");num(c,"count",1,6,true);}
    values(r,"lowCountDecision",["pending","continue"],true);mealMap.set(key,r);
  }
  const appRows: Row[]=[];
  for(const value of applications) {
    const r=obj(value,["id","userId","mealId","appliedAt","decidedAt","decision","confirmedAt","withdrawnAt","expired"],"application");unique(appIds,id(r),"application");if(!userIds.has(id(r,"userId")) || !mealIds.has(id(r,"mealId"))) fail("application relation");const m=mealMap.get(r.mealId as string)!;
    if(r.userId===m.hostId) fail("host application"); const applied=time(r,"appliedAt")!,decided=time(r,"decidedAt",true),confirmed=time(r,"confirmedAt",true),withdrawn=time(r,"withdrawnAt",true);
    if(applied<(m.publishedAt as string) || applied>asOf || +new Date(applied)>=+new Date(m.startsAt as string)-45*60_000) fail("application cutoff");
    values(r,"decision",["approved","declined"],true);
    if(!!decided !== !!r.decision || (decided && (decided<applied || decided>asOf || +new Date(decided)>=+new Date(m.startsAt as string)-30*60_000))) fail("decision time/state");
    if(confirmed && (r.decision!=="approved" || confirmed!==decided || confirmed>asOf)) fail("confirmedAt");
    if(r.decision==="approved" && !confirmed) fail("R1 approval must confirm seat");
    if(withdrawn && (withdrawn<applied || withdrawn>asOf)) fail("withdrawnAt");
    if(r.expired!==undefined && typeof r.expired!=="boolean") fail("expired"); if(r.expired && (decided || confirmed)) fail("expired with decision"); appRows.push(r);
  }
  // R1 re-entry is per user + meal, not merely unique application IDs.
  const rounds=new Map<string,Row[]>();
  for(const a of appRows){const key=`${a.userId}:${a.mealId}`;rounds.set(key,[...(rounds.get(key)||[]),a]);}
  for(const group of rounds.values()) {
    group.sort((a,b)=>(a.appliedAt as string).localeCompare(b.appliedAt as string));
    for(let i=1;i<group.length;i++) {
      const prior=group[i-1],current=group[i];
      if(group.slice(0,i).some(a=>a.decision==="declined")) fail("reapplication after decline");
      if(prior.expired || !prior.withdrawnAt || (prior.withdrawnAt as string)>(current.appliedAt as string)) fail("overlapping application rounds");
    }
  }
  for(const [mealId,m] of mealMap) {
    const confirmed=appRows.filter(a=>a.mealId===mealId && a.confirmedAt);
    for(const event of confirmed) {
      const at=event.confirmedAt as string;
      const count=1+new Set(confirmed.filter(a=>(a.confirmedAt as string)<=at && (!a.withdrawnAt || (a.withdrawnAt as string)>at)).map(a=>a.userId)).size;
      if(count>(m.capacity as number)) fail("confirmed capacity exceeded");
    }
  }
  const seenAttendance=new Set<string>(), seenFeedback=new Set<string>();
  function eligible(r:Row) {const m=mealMap.get(id(r,"mealId"));const uid=id(r,"userId"); if(!m || !userIds.has(uid) || m.cancelled) return fail("participation relation"); if(uid!==m.hostId && !appRows.some(a=>a.userId===uid && a.mealId===m.id && a.confirmedAt && (a.confirmedAt as string)<m.startsAt! && (!a.withdrawnAt || (a.withdrawnAt as string)>m.startsAt!))) fail("ineligible participant");return m;}
  const attMap=new Map<string,Row>();
  for(const value of attendance) {const r=obj(value,["userId","mealId","host","self","updatedAt"],"attendance");const m=eligible(r);const key=`${r.userId}:${r.mealId}`;unique(seenAttendance,key,"attendance");const at=time(r,"updatedAt")!;values(r,"host",["present","absent"],true);values(r,"self",["present","absent"],true);if(at>asOf || ((r.host||r.self) && (at<(m.endsAt as string) || +new Date(at)>=+new Date(m.endsAt as string)+7*86_400_000))) fail("attendance window");attMap.set(key,r);}
  const reasonCodes=["company","conversation","coordination","expectations","venue","cost","other"];
  for(const value of feedback) {const r=obj(value,["userId","mealId","score","again","reasons","at","issue"],"feedback");const m=eligible(r),key=`${r.userId}:${r.mealId}`;unique(seenFeedback,key,"feedback");const at=time(r,"at")!;num(r,"score",1,5,true);if(typeof r.again!=="boolean" || !Array.isArray(r.reasons) || r.reasons.length>7 || r.reasons.some(v=>!reasonCodes.includes(v))) fail("feedback fields");values(r,"issue",["none"],true);const a=attMap.get(key);if(!a || (a.self||a.host)!=="present" || at>asOf || at<(m.endsAt as string) || +new Date(at)>=+new Date(m.endsAt as string)+7*86_400_000) fail("feedback eligibility/window");}
  return {contractVersion:CONTRACT_VERSION,demo:true,asOf,data:structuredClone({users,meals,applications,attendance,feedback,events}) as Dataset};
}
