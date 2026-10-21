import type { CLIENT_EVENT_TYPES } from '@fancy/contracts';
export type EventType=Exclude<(typeof CLIENT_EVENT_TYPES)[number],'discovery_failed'>;
export type Properties=Record<string,string|number|boolean|null>;
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const keys:Record<EventType,string[]>={discovery_results:['discoveryRequestId'],meal_impression:['mealId','discoveryRequestId','visibleRatio','durationMs','eligible','foreground'],detail_view:['mealId','discoveryRequestId'],create_started:['attemptId'],create_arranged:['attemptId'],form_error:['attemptId','step','field','errorCode'],filter_applied:['filter'],map_opened:[],profile_view:['userId'],chat_opened:['conversationId']};
export const FORM_FIELDS=['venue','capacity','minimum','date','time','closeDate','closeTime','title','description','mood','languages','budgetMin','budgetMax','bookingConfirmed','reviewConfirmed'] as const;
export const ERROR_CODES=['required','invalid','too_short','too_long','out_of_range','time_ambiguous','time_nonexistent','unavailable'] as const;
/** Reject rather than silently strip arbitrary caller data, including input text. */
export function allowedEvent(type:EventType,p:Properties):boolean {
  if(!keys[type]||Object.keys(p).some(k=>!keys[type].includes(k)))return false;
  if(['create_started','create_arranged','form_error'].includes(type)&&!uuid(p.attemptId))return false;
  if(['meal_impression','detail_view'].includes(type)&&!uuid(p.mealId))return false;
  if(type==='discovery_results'&&!uuid(p.discoveryRequestId))return false;
  if(type==='detail_view'&&p.discoveryRequestId!==undefined&&!uuid(p.discoveryRequestId))return false;
  if(type==='meal_impression'&&(!uuid(p.discoveryRequestId)||typeof p.visibleRatio!=='number'||p.visibleRatio<0.5||p.visibleRatio>1||typeof p.durationMs!=='number'||p.durationMs<1000||p.durationMs>3600000||p.eligible!==true||p.foreground!==true))return false;
  if(type==='profile_view'&&!uuid(p.userId)||type==='chat_opened'&&!uuid(p.conversationId))return false;
  if(type==='filter_applied'&&!['area','dates','languages','capacity','budget','cuisine','dietary'].includes(String(p.filter)))return false;
  if(type==='form_error'&&(!['arrange','introduce','costs','review'].includes(String(p.step))||!(FORM_FIELDS as readonly string[]).includes(String(p.field))||!(ERROR_CODES as readonly string[]).includes(String(p.errorCode))))return false;
  return true;
}
