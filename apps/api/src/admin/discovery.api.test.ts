import{randomUUID}from'node:crypto';
import{afterAll,beforeAll,describe,expect,inject,it,vi}from'vitest';
import{Browser,createHarness,json,type Harness}from'../test/harness.ts';
import{FixturePlacesProvider}from'../venues/fixture-provider.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function host(){const b=new Browser(h);const{body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);return body.data.session.user.id as string;}
describe('production discovery source hook',()=>{
 it('counts full regular-host eligible set before pagination, skips unconsented visitors and resolves shared provider once',async()=>{
  const regular=await host(),test=await host();await h.db.pool.query(`INSERT INTO account_classifications(user_id,classification,actor_id,reason) VALUES($1,'test',$1,'Synthetic test host')`,[test]);
  const venue=randomUUID();await h.db.pool.query(`INSERT INTO venues(id,place_id,provider) VALUES($1,'fixture_fancy_north','fixture')`,[venue]);
  for(const[hostId,date]of[[test,'2026-12-01'],[regular,'2026-12-02'],[regular,'2026-12-03']]){
   const id=randomUUID();await h.db.pool.query(`INSERT INTO meals(id,host_id,venue_ref,title,description,starts_at,closes_at,scheduled_end_at,start_local_date,start_local_time,start_offset,close_local_date,close_local_time,close_offset,minimum,capacity,budget_min_pence,budget_max_pence,languages,mood,area_code,booking_mode,terms_version,attempt_id) VALUES($1,$2,$3,'Future shared meal','A future fixture shared meal for discovery.',$4::date+interval '12 hours',$4::date+interval '11 hours',$4::date+interval '14 hours',$4,'12:00',0,$4,'11:00',0,2,3,1000,3000,ARRAY['en'],'EASY_CONVERSATION','soho','EXTERNAL_PAY_AT_VENUE','2026-10-21',$5)`,[id,hostId,venue,date,randomUUID()]);
   await h.db.pool.query(`INSERT INTO seat_events(meal_id,seq,user_id,type,effective_at,command_id) VALUES($1,1,$2,'HOST_CONFIRMED',clock_timestamp(),$3)`,[id,hostId,randomUUID()]);
  }
  const visitor=new Browser(h);expect((await visitor.request('GET','/v1/meals?limit=1')).statusCode).toBe(200);expect((await h.db.pool.query(`SELECT 1 FROM analytics_discovery_requests`)).rows).toHaveLength(0);
  await visitor.request('POST','/v1/analytics/events',{body:{schemaVersion:1,consent:{analytics:true,version:'2026-10-21'},events:[]}});
  expect((await visitor.request('GET','/v1/meals?limit=1')).statusCode).toBe(200);expect((await h.db.pool.query(`SELECT 1 FROM analytics_discovery_requests`)).rows).toHaveLength(0);
  const provider=vi.spyOn(FixturePlacesProvider.prototype,'details');
  const response=await visitor.request('GET','/v1/meals?limit=1',{headers:{'x-fancy-analytics':'enabled'}});expect(response.statusCode,response.body).toBe(200);expect(json(response).data).toHaveLength(1);expect(json(response).page.hasMore).toBe(true);expect(provider).toHaveBeenCalledTimes(1);
  const{rows}=await h.db.pool.query(`SELECT result_count,result_meal_ids,eligible_meal_ids FROM analytics_discovery_requests WHERE request_id=$1`,[json(response).meta.requestId]);expect(rows[0].result_count).toBe(2);expect(rows[0].result_meal_ids).toHaveLength(1);expect(rows[0].eligible_meal_ids).toEqual([]);
 });
});
