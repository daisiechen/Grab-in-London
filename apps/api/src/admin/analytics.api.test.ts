import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { loadConfig } from '@fancy/config';
import { Browser, createHarness, json, WEB_ORIGIN, type Harness } from '../test/harness.ts';
import { ANALYTICS_CONSENT_VERSION, registerAnalyticsIngest,recordDiscoveryOutcome } from './ingest.ts';
import { sealSourceSnapshot } from './snapshots.ts';
import { readAdminPage } from './pages.ts';
let h: Harness;
beforeAll(async () => {
  h=await createHarness(inject('pgServerUrl'));
  if (!h.app.hasRoute({method:'POST',url:'/v1/analytics/events'})) registerAnalyticsIngest(h.app,{pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN,
    config:loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'})});
  h.app.get('/_test/actual-empty-discovery',async request=>{
    const{rows}=await h.db.pool.query(`SELECT id FROM meals WHERE status='OPEN' AND starts_at>clock_timestamp()`);
    const recorded=await recordDiscoveryOutcome({pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN,config:loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'})},{request,auth:null,params:{languages:'en',keyword:'DO_NOT_STORE_SEARCH_TEXT'},resultCount:rows.length,resultMealIds:rows.map(r=>r.id),eligibleMealIds:rows.map(r=>r.id),outcome:'success'});
    return{requestId:request.id,recorded};
  });
});
afterAll(async()=>{await h.close();});
const event=()=>({eventId:randomUUID(),type:'map_opened',occurredAt:new Date().toISOString(),anonymousId:'client-anonymous',sessionId:'client-session',appVersion:'1.0.0',properties:{}});
const send=(b:Browser,events:unknown[],analytics=true,version=ANALYTICS_CONSENT_VERSION)=>b.request('POST','/v1/analytics/events',{body:{schemaVersion:1,consent:{analytics,version},events}});
async function consent(b:Browser){expect((await send(b,[])).statusCode).toBe(200);}
describe('analytics consent and ingestion',()=>{
  it('establishes and withdraws consent without manufacturing a client event',async()=>{
    const b=new Browser(h);const before=Number((await h.db.pool.query(`SELECT count(*) FROM analytics_events`)).rows[0].count);
    expect(json(await send(b,[])).data.results).toEqual([]);
    expect(json(await send(b,[],false)).data.results).toEqual([]);
    expect(Number((await h.db.pool.query(`SELECT count(*) FROM analytics_events`)).rows[0].count)).toBe(before);
    expect(json(await send(b,[event()],false)).data.results[0].reason).toBe('consent_required');
  });
  it('requires explicit current consent, never backfills before consent, and rejects after withdrawal',async()=>{
    const b=new Browser(h);
    expect(json(await send(b,[event()],false)).data.results[0].reason).toBe('consent_required');
    expect(json(await send(b,[event()],true,'old-policy')).data.results[0].reason).toBe('consent_required');
    await consent(b);
    expect(json(await send(b,[{...event(),occurredAt:'2020-01-01T00:00:00.000Z'}])).data.results[0].reason).toBe('outside_consent_window');
    expect(json(await send(b,[event()])).data.results[0].status).toBe('accepted');
    expect(json(await send(b,[event()],false)).data.results[0].status).toBe('rejected');
    expect(json(await send(b,[event()],true)).data.results[0].reason).toBe('consent_required');
  });
  it('deduplicates one event with identical context and rejects changed payload or another scope',async()=>{
    const a=new Browser(h),b=new Browser(h);await consent(a);await consent(b);
    const e=event();
    expect(json(await send(a,[e])).data.results[0].status).toBe('accepted');
    expect(json(await send(a,[e])).data.results[0].status).toBe('duplicate');
    expect(json(await send(a,[{...e,appVersion:'2.0.0'}])).data.results[0].reason).toBe('event_id_conflict');
    expect(json(await send(b,[e])).data.results[0].reason).toBe('event_id_conflict');
  });
  it('rejects raw free text, business success claims, weak exposure and cross-site guests',async()=>{
    const b=new Browser(h);await consent(b);
    for(const e of [{...event(),properties:{message:'private text'}},{...event(),type:'discovery_results',properties:{requestId:randomUUID(),resultCount:0}},{...event(),type:'meal_impression',properties:{mealId:randomUUID(),visibleRatio:.2,durationMs:1000,eligible:true,foreground:true}}]) expect(json(await send(b,[e])).data.results[0].status).toBe('rejected');
    const evil=new Browser(h,'https://evil.invalid');
    expect((await send(evil,[event()])).statusCode).toBe(403);
  });
  it('binds only current authenticated events, never relinks guest history',async()=>{
    const b=new Browser(h);await consent(b);const old=event();await send(b,[old]);
    const login=await b.signInWithEmail(`${randomUUID()}@example.invalid`);await consent(b);
    const current=event();expect(json(await send(b,[current])).data.results[0].status).toBe('accepted');
    const {rows}=await h.db.pool.query(`SELECT event_id,user_id FROM analytics_events WHERE event_id=ANY($1::uuid[])`,[[old.eventId,current.eventId]]);
    expect(rows.find(r=>r.event_id===old.eventId).user_id).toBeNull();
    expect(rows.find(r=>r.event_id===current.eventId).user_id).toBe(login.body.data.session.user.id);
  });
  it('accepts rendered discovery only from the same signed scope and copies server count, never client values',async()=>{
    const guest=new Browser(h),other=new Browser(h);
    expect(json(await guest.request('GET','/_test/actual-empty-discovery',{headers:{'x-fancy-analytics':'enabled'}})).recorded).toBe(false);
    await consent(guest);await consent(other);
    const source=json(await guest.request('GET','/_test/actual-empty-discovery',{headers:{'x-fancy-analytics':'enabled'}}));expect(source.recorded).toBe(true);
    const rendered={...event(),type:'discovery_results',properties:{discoveryRequestId:source.requestId}};
    expect(json(await send(guest,[rendered])).data.results[0].status).toBe('accepted');
    expect(json(await send(guest,[rendered])).data.results[0].status).toBe('duplicate');
    expect(json(await send(other,[{...rendered,eventId:randomUUID()}])).data.results[0].reason).toBe('invalid_discovery_request');
    expect(json(await send(guest,[{...rendered,eventId:randomUUID(),properties:{discoveryRequestId:source.requestId,resultCount:999}}])).data.results[0].status).toBe('rejected');
    const{rows}=await h.db.pool.query(`SELECT properties FROM analytics_events WHERE event_id=$1`,[rendered.eventId]);expect(rows[0].properties).toMatchObject({resultCount:0,rendered:true});expect(JSON.stringify(rows)).not.toContain('DO_NOT_STORE_SEARCH_TEXT');
    const{rows:ledger}=await h.db.pool.query(`SELECT outcome,reason FROM analytics_deliveries WHERE event_id=$1`,[rendered.eventId]);expect(ledger.map(r=>r.outcome).sort()).toEqual(['accepted','duplicate']);
  });
  it('records malformed required-field deliveries without retaining body or private field values',async()=>{
    const b=new Browser(h);await consent(b);const malformed={...event(),appVersion:undefined};
    const result=await send(b,[malformed]);expect(result.statusCode).toBe(422);
    const{rows}=await h.db.pool.query(`SELECT outcome,reason FROM analytics_deliveries WHERE event_id IS NULL AND reason='missing_required'`);expect(rows.length).toBeGreaterThan(0);
  });
});
describe('source snapshot isolation',()=>{
  it('computes latest survey from frozen source, leaves unsupported metrics null and rejects privacy-stale snapshots',async()=>{
    const b=new Browser(h);const result=await b.signInWithEmail(`${randomUUID()}@example.invalid`);
    const userId=result.body.data.session.user.id;
    await h.db.pool.query(`INSERT INTO product_surveys(user_id,version,again,reasons,submitted_at) VALUES($1,1,false,ARRAY['cost'],clock_timestamp()-interval '1 second')`,[userId]);
    const id=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01T00:00:00Z'));
    const before=await readAdminPage(h.db.pool,'retention',{snapshotId:id});
    expect(before.metrics.survey).toMatchObject({numerator:0,denominator:1});
    expect(before.metrics.retention).toEqual({numerator:0,denominator:0});
    await h.db.pool.query(`INSERT INTO product_surveys(user_id,version,again,reasons,submitted_at) VALUES($1,2,true,ARRAY[]::text[],clock_timestamp())`,[userId]);
    expect((await readAdminPage(h.db.pool,'retention',{snapshotId:id})).metrics.survey).toEqual(before.metrics.survey);
    const supply=await readAdminPage(h.db.pool,'supply',{snapshotId:id});
    expect(supply.metrics.coverage).toEqual({numerator:0,denominator:0});
    expect(supply.metrics.formation).toEqual({numerator:0,denominator:0});
    await expect(readAdminPage(h.db.pool,'supply',{snapshotId:id,sources:'assisted'})).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE'});
    await h.db.pool.query(`UPDATE privacy_control SET epoch=epoch+1 WHERE id=1`);
    await expect(readAdminPage(h.db.pool,'retention',{snapshotId:id})).rejects.toMatchObject({code:'SNAPSHOT_REVOKED'});
  });
  it('freezes actual facts and marks unsupported attendance instead of manufacturing metrics',async()=>{
    const b=new Browser(h);const result=await b.signInWithEmail(`${randomUUID()}@example.invalid`);
    const userId=result.body.data.session.user.id;
    const id=await sealSourceSnapshot(h.db.pool,new Date('2026-01-01T00:00:00Z'));
    const {rows:metadata}=await h.db.pool.query(`SELECT source_status,quality FROM analytics_snapshots WHERE id=$1`,[id]);
    expect(metadata[0].source_status.attendance).toBe('ready');
    const {rows:before}=await h.db.pool.query(`SELECT facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 AND kind='users'`,[id]);
    await h.db.pool.query(`UPDATE users SET status='DELETING' WHERE id=$1`,[userId]);
    const {rows:after}=await h.db.pool.query(`SELECT facts FROM analytics_snapshot_facts WHERE snapshot_id=$1 AND kind='users'`,[id]);
    expect(after).toEqual(before);
    expect(before[0].facts.some((u:{id:string})=>u.id===userId)).toBe(true);
    expect((await h.db.pool.query(`SELECT 1 FROM analytics_snapshot_subjects WHERE snapshot_id=$1 AND user_id=$2`,[id,userId])).rows).toHaveLength(1);
  });
});
