import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance,FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import type { OperationById } from '@fancy/contracts';
import type { AppDeps,AuthContext } from '../http/context.ts';
import { defineRoute } from '../http/routes.ts';
import { withTransaction } from '../common/transaction.ts';
import { lockActiveActor } from '../common/actor.ts';
import { requestHash } from '../common/canonical.ts';
import { assertWebOrigin } from '../http/security.ts';

export const ANALYTICS_CONSENT_VERSION = '2026-10-21';
const COOKIE = 'fancy_analytics_scope';
type IngestBody = Static<OperationById<'ingestEvents'>['body']>;
type Event = IngestBody['events'][number];
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const KEYS: Record<Event['type'], string[]> = {
  discovery_results: ['discoveryRequestId'], discovery_failed: ['requestId','errorCode'],
  meal_impression: ['mealId','discoveryRequestId','visibleRatio','durationMs','eligible','foreground'], detail_view: ['mealId','discoveryRequestId'],
  create_started: ['attemptId'], create_arranged: ['attemptId'], form_error: ['attemptId','step','field','errorCode'],
  filter_applied: ['filter'], map_opened: [], profile_view: ['userId'], chat_opened: ['conversationId'],
};
const FIELDS = new Set(['venue','capacity','minimum','date','time','closeDate','closeTime','title','description','mood','languages','budgetMin','budgetMax','bookingConfirmed','reviewConfirmed']);
const ERRORS = new Set(['required','invalid','too_short','too_long','out_of_range','time_ambiguous','time_nonexistent','unavailable']);
function invalid(event: Event): string | null {
  const p = event.properties;
  const required=event.type==='meal_impression'?['mealId','discoveryRequestId','visibleRatio','durationMs','eligible','foreground']:event.type==='detail_view'?['mealId']:['create_started','create_arranged','form_error'].includes(event.type)?['attemptId']:[];
  if(required.some(key=>!(key in p)))return 'missing_required';
  if (Object.keys(p).some(k => !KEYS[event.type].includes(k))) return 'properties_not_allowed';
  if(event.type==='discovery_failed')return 'server_fact_required';
  if(event.type==='discovery_results'&&!uuid(p.discoveryRequestId))return 'invalid_discovery_request';
  if (['create_started','create_arranged','form_error'].includes(event.type) && !uuid(p.attemptId)) return 'invalid_attempt';
  if (['detail_view','meal_impression'].includes(event.type) && !uuid(p.mealId)) return 'invalid_meal';
  if (event.type === 'profile_view' && !uuid(p.userId)) return 'invalid_user';
  if (event.type === 'chat_opened' && !uuid(p.conversationId)) return 'invalid_conversation';
  if (event.type === 'filter_applied' && !['area','dates','languages','capacity','budget','cuisine','dietary'].includes(String(p.filter))) return 'invalid_filter';
  if (event.type === 'form_error' && (!['arrange','introduce','costs','review'].includes(String(p.step)) || !FIELDS.has(String(p.field)) || !ERRORS.has(String(p.errorCode)))) return 'invalid_form_error';
  if (event.type === 'meal_impression' && (typeof p.visibleRatio !== 'number' || p.visibleRatio < .5 || p.visibleRatio > 1 || typeof p.durationMs !== 'number' || p.durationMs < 1000 || p.durationMs > 3600000 || p.eligible !== true || p.foreground !== true)) return 'invalid_impression';
  if(event.type==='meal_impression'&&!uuid(p.discoveryRequestId))return 'invalid_discovery_request';
  return null;
}
function guestScope(cookie: string | undefined, secret: string): { id: string; value: string } {
  const sign = (id: string) => createHmac('sha256', secret).update('analytics:'+id).digest('base64url');
  if (cookie && /^[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(cookie)) {
    const [id,mac] = cookie.split('.') as [string,string];
    if (timingSafeEqual(Buffer.from(mac),Buffer.from(sign(id)))) return { id,value: cookie };
  }
  const id = randomBytes(32).toString('base64url');
  return { id,value: id+'.'+sign(id) };
}
export async function hasAnalyticsConsent(deps:AppDeps,request:FastifyRequest,auth:AuthContext|null):Promise<boolean>{
 if(request.headers['x-fancy-analytics']!=='enabled')return false;
 const cookie=request.cookies[COOKIE];if(!cookie)return false;const guest=guestScope(cookie,deps.config.sessionSecret);if(guest.value!==cookie)return false;
 const{rows}=await deps.pool.query(`SELECT 1 FROM analytics_consents WHERE scope_key=$1 AND version=$2 AND granted_at IS NOT NULL`,[auth?'family:'+auth.familyId:'guest:'+guest.id,ANALYTICS_CONSENT_VERSION]);return rows.length===1;
}
export function registerAnalyticsIngest(app: FastifyInstance, deps: AppDeps) {
  app.addHook('onError',async(request,_reply,error)=>{
    if(request.url.split('?')[0]!=='/v1/analytics/events'||!error.validation?.some(issue=>issue.keyword==='required'))return;
    // Operational quality counters only: no malformed IDs, body, field names or private input.
    const indices=new Set(error.validation.filter(issue=>issue.keyword==='required').flatMap(issue=>{const match=/^\/events\/(\d+)(?:\/|$)/.exec(issue.instancePath);return match?[match[1]!]:[];}));
    try{for(let i=0;i<Math.max(1,indices.size);i++)await deps.pool.query(`INSERT INTO analytics_deliveries(outcome,reason,environment,classification) VALUES('rejected',$1,$2,'unknown')`,[indices.size?'missing_required':'invalid_envelope',deps.config.environment]);}catch{request.log.warn({code:'ANALYTICS_LEDGER_UNAVAILABLE'},'analytics delivery counter unavailable');}
  });
  defineRoute(app,deps,'ingestEvents',async ({ request,reply,auth }) => {
    // Optional-session endpoints still reject cross-site browser submissions by guests.
    if (request.headers.origin) assertWebOrigin(request,deps.config.webOrigin);
    const body = request.body as IngestBody;
    const guest = guestScope(request.cookies[COOKIE],deps.config.sessionSecret);
    const scope = auth ? 'family:'+auth.familyId : 'guest:'+guest.id;
    const results = await withTransaction(deps.pool,async tx => {
      if (auth) await lockActiveActor(tx,auth.userId);
      const { rows: clock } = await tx.client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
      const now = clock[0]!.now;
      await tx.client.query(`INSERT INTO analytics_consents(scope_key,version,granted_at,updated_at) VALUES($1,$2,NULL,$3) ON CONFLICT DO NOTHING`,[scope,ANALYTICS_CONSENT_VERSION,now]);
      const { rows: consentRows } = await tx.client.query<{ version: string; granted_at: Date|null }>(`SELECT version,granted_at FROM analytics_consents WHERE scope_key=$1 FOR UPDATE`,[scope]);
      const current = consentRows[0]!;
      const optedIn = body.consent.analytics && body.consent.version === ANALYTICS_CONSENT_VERSION;
      // Event delivery can arrive after withdrawal. Only an explicit empty consent
      // command may establish a grant; a stale batch can never silently reopen it.
      const grantedAt = body.events.length ? (optedIn&&current.version===ANALYTICS_CONSENT_VERSION?current.granted_at:null) : optedIn ? current.version === ANALYTICS_CONSENT_VERSION && current.granted_at ? current.granted_at : now : null;
      await tx.client.query(`UPDATE analytics_consents SET version=$2,granted_at=$3,updated_at=$4 WHERE scope_key=$1`,[scope,ANALYTICS_CONSENT_VERSION,grantedAt,now]);
      const { rows: classes } = auth ? await tx.client.query(`SELECT classification FROM account_classifications WHERE user_id=$1 ORDER BY revision DESC LIMIT 1`,[auth.userId]) : { rows: [] };
      const classification = classes[0]?.classification ?? 'regular';
      const results = [];
      for (const event of body.events) {
        let reason = !grantedAt ? 'consent_required' : invalid(event);
        const occurred = new Date(event.occurredAt);
        if (!reason && (occurred < grantedAt! || occurred > now)) reason = 'outside_consent_window';
        if (reason) { results.push({ eventId:event.eventId,status:'rejected' as const,reason }); continue; }
        let properties:Record<string,unknown>=event.properties;
        if(event.type==='discovery_results'){
          const{rows:discovery}=await tx.client.query(`SELECT request_id,result_count,filters FROM analytics_discovery_requests WHERE request_id=$1 AND scope_key=$2 AND outcome='success' AND received_at<=$3`,[event.properties.discoveryRequestId,scope,occurred]);
          if(!discovery[0]){results.push({eventId:event.eventId,status:'rejected' as const,reason:'invalid_discovery_request'});continue;}
          properties={discoveryRequestId:discovery[0].request_id,resultCount:discovery[0].result_count,filters:discovery[0].filters,rendered:true};
        }
        if (event.type === 'meal_impression') {
          const { rows } = await tx.client.query(`SELECT request_id FROM analytics_discovery_requests WHERE request_id=$1 AND scope_key=$2 AND outcome='success' AND received_at<=$3 AND $4::uuid=ANY(eligible_meal_ids)`,[event.properties.discoveryRequestId,scope,occurred,event.properties.mealId]);
          if (!rows.length) { results.push({eventId:event.eventId,status:'rejected' as const,reason:'not_eligible'}); continue; }
        }
        const hash = requestHash({method:'POST',path:'/v1/analytics/events',body:{scope,event}});
        const { rows } = await tx.client.query(`INSERT INTO analytics_events(event_id,anonymous_id,user_id,session_id,app_version,auth_family_id,type,occurred_at,received_at,schema_version,environment,consent_version,classification,properties,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10,$11,$12,$13,$14) ON CONFLICT DO NOTHING RETURNING event_id`,[event.eventId,guest.id,auth?.userId ?? null,auth?.familyId??guest.id,event.appVersion,auth?.familyId ?? null,event.type,occurred,now,deps.config.environment,ANALYTICS_CONSENT_VERSION,classification,properties,hash]);
        if (rows.length) results.push({eventId:event.eventId,status:'accepted' as const});
        else {
          const { rows: previous } = await tx.client.query(`SELECT request_hash FROM analytics_events WHERE event_id=$1`,[event.eventId]);
          results.push(previous[0]?.request_hash === hash || (!previous.length && event.type==='meal_impression') ? {eventId:event.eventId,status:'duplicate' as const} : {eventId:event.eventId,status:'rejected' as const,reason:'event_id_conflict'});
        }
      }
      for(const result of results)await tx.client.query(`INSERT INTO analytics_deliveries(event_id,user_id,outcome,reason,environment,classification) VALUES($1,$2,$3,$4,$5,$6)`,[result.eventId,auth?.userId??null,result.status,'reason'in result?result.reason:null,deps.config.environment,classification]);
      return results;
    });
    // Native transports do not consistently expose Set-Cookie. This opaque scope is
    // analytics-only, never a user/AI credential or a grant by itself. Browser requests
    // retain the HttpOnly boundary; native clients must still prove consent on each scope.
    if(request.headers['x-fancy-analytics-client']==='native'&&!request.headers.origin&&!auth?.viaCookie)reply.header('x-fancy-analytics-scope',guest.value);
    else reply.setCookie(COOKIE,guest.value,{ httpOnly:true,secure:['staging','production'].includes(deps.config.environment),sameSite:'lax',path:'/',maxAge:86400 });
    return {data:{results}};
  });
}

/** Server-only fact hook; values come from the actual discover handler, never client events. */
export async function recordDiscoveryOutcome(deps:AppDeps,input:{request:FastifyRequest;auth:AuthContext|null;params:Record<string,unknown>;resultCount:number;resultMealIds:string[];eligibleMealIds?:string[];outcome:'success'|'failed'}):Promise<boolean>{
 const{request,auth}=input;if(request.headers['x-fancy-analytics']!=='enabled')return false;const cookie=request.cookies[COOKIE];if(!cookie)return false;
 const guest=guestScope(cookie,deps.config.sessionSecret);if(guest.value!==cookie)return false;
 if(!uuid(request.id)||!Number.isInteger(input.resultCount)||input.resultCount<0||input.resultMealIds.some(id=>!uuid(id)))return false;
 const eligible=(input.eligibleMealIds??[]).filter(id=>input.resultMealIds.includes(id));
 const scope=auth?'family:'+auth.familyId:'guest:'+guest.id;
 const filters=Object.fromEntries(Object.entries(input.params).filter(([key])=>['dates','timeOfDay','areaCodes','budgetMaxPence','tableSizes','languages','moods','cuisineCodes','dietaryCodes'].includes(key)));
 return withTransaction(deps.pool,async tx=>{
  if(auth)await lockActiveActor(tx,auth.userId);
  const{rows:clock}=await tx.client.query<{now:Date}>('SELECT clock_timestamp() AS now');const now=clock[0]!.now;
  const{rows:consents}=await tx.client.query<{granted_at:Date|null;version:string}>(`SELECT granted_at,version FROM analytics_consents WHERE scope_key=$1 FOR SHARE`,[scope]);
  if(!consents[0]?.granted_at||consents[0].version!==ANALYTICS_CONSENT_VERSION)return false;
  const{rows:classes}=auth?await tx.client.query(`SELECT classification FROM account_classifications WHERE user_id=$1 ORDER BY revision DESC LIMIT 1`,[auth.userId]):{rows:[]};
  const classification=classes[0]?.classification??'regular';const session=auth?.familyId??guest.id;
  const{rows}=await tx.client.query(`INSERT INTO analytics_discovery_requests(request_id,scope_key,anonymous_id,user_id,session_id,result_count,result_meal_ids,eligible_meal_ids,outcome,filters,occurred_at,received_at,environment,classification) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13) ON CONFLICT DO NOTHING RETURNING request_id`,[request.id,scope,guest.id,auth?.userId??null,session,input.resultCount,input.resultMealIds,eligible,input.outcome,filters,now,deps.config.environment,classification]);
  if(!rows.length)return true;
  const type=input.outcome==='success'?'discovery_results':'discovery_failed';const properties={requestId:request.id,resultCount:input.resultCount,filters,serverOnly:true};
  await tx.client.query(`INSERT INTO analytics_events(event_id,anonymous_id,user_id,session_id,app_version,auth_family_id,type,occurred_at,received_at,schema_version,environment,consent_version,classification,properties,request_hash) VALUES($1,$2,$3,$4,'server',$5,$6,$7,$7,1,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,[request.id,guest.id,auth?.userId??null,session,auth?.familyId??null,type,now,deps.config.environment,ANALYTICS_CONSENT_VERSION,classification,properties,requestHash({method:'GET',path:'/v1/meals',body:{scope,properties}})]);
  return true;
 });
}
