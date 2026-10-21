import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {Browser,createHarness,json,type Harness} from '../apps/api/src/test/harness.ts';
import {londonTime} from '../apps/api/src/meals/time.ts';
import {validateArrangement,type Arrangement} from '../apps/api/src/meals/commands.ts';
import {defaultClose} from '../apps/web/src/features/create/model.ts';
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});afterAll(async()=>{await h.close();});
async function actor(complete=true){const b=new Browser(h);const {body}=await b.signInWithEmail(`${randomUUID()}@example.invalid`);if(complete){const response=await b.request('PATCH','/v1/me',{body:{displayName:'Alex Test',bio:'I enjoy shared meals and meeting new people.',languages:['en','zh'],lifeStatus:'NEW_TO_LONDON',interests:['FOOD'],ageConfirmedVersion:'2026-10-21',communityAcceptedVersion:'2026-10-21'},headers:{'if-match':'"1"','idempotency-key':randomUUID()}});expect(response.statusCode,response.body).toBe(200);}return {b,id:body.data.session.user.id as string};}
function times(days=5){const start=new Date(Math.floor((Date.now()+days*86_400_000)/60_000)*60_000);const close=new Date(start.getTime()-3_600_000);return {start:londonTime(start),close:londonTime(close)};}
const timeInput=(t:ReturnType<typeof londonTime>)=>({localDate:t.localDate,localTime:t.localTime,timeZone:t.timeZone,utcOffsetMinutes:t.utcOffsetMinutes});
async function create(host:Browser,extra:Record<string,unknown>={},key=randomUUID()){
 const confirmed=await host.request('POST','/v1/venues/confirm',{body:{placeId:'fixture_fancy_north'},headers:{'idempotency-key':randomUUID()}});expect(confirmed.statusCode,confirmed.body).toBe(200);
 const t=times();const body={venueRef:json(confirmed).data.venueRef,title:'Friendly lunch with new people',description:'Join a relaxed meal to share stories and good food.',start:timeInput(t.start),close:timeInput(t.close),minimum:2,capacity:3,budgetMinPence:1000,budgetMaxPence:3000,languages:['en','zh'],mood:'EASY_CONVERSATION',cuisineCode:'CHINESE',dietaryCodes:['VEGAN'],bookingMode:'EXTERNAL_PAY_AT_VENUE',attemptId:randomUUID(),bookingDeclarationConfirmed:true,reviewConfirmed:true,termsVersion:'2026-10-21',...extra};
 const result=await host.request('POST','/v1/meals',{body,headers:{'idempotency-key':key}});return {result,body,key};
}

it.each([[2,2],[3,4],[6,6]])('QA-CREATE-003 server legal minimum%s/capacity%s includes exactly one host seat',async(minimum,capacity)=>{
 const host=await actor();const {result}=await create(host.b,{minimum,capacity});expect(result.statusCode,result.body).toBe(201);const m=json(result).data;expect(m).toMatchObject({minimum,capacity,confirmedCount:1});expect((await h.db.pool.query('SELECT user_id,type FROM seat_events WHERE meal_id=$1',[m.id])).rows).toEqual([{user_id:host.id,type:'HOST_CONFIRMED'}]);
});
it.each([[1,4],[5,4],[3,7],[2.5,4],[2,3.5]])('QA-CREATE-003 server rejects minimum%s/capacity%s without publishing',async(minimum,capacity)=>{
 const host=await actor();const {result,body}=await create(host.b,{minimum,capacity});expect(result.statusCode,result.body).toBe(422);expect((await h.db.pool.query('SELECT count(*)::int n FROM meals WHERE attempt_id=$1',[body.attemptId])).rows[0].n).toBe(0);
});
it('QA-DB-012 exact now and start minus30/minus29 boundaries use supplied effective time',()=>{
 const close={localDate:'2026-11-10',localTime:'11:30',timeZone:'Europe/London',utcOffsetMinutes:0};
 const input:Arrangement={venueRef:randomUUID(),title:'Boundary test meal',description:'A synthetic meal for exact publication deadline validation.',start:{...close,localTime:'12:00'},close,minimum:2,capacity:2,budgetMinPence:1000,budgetMaxPence:2000,languages:['en'],mood:'EASY_CONVERSATION'};
 expect(()=>validateArrangement(input,new Date('2026-11-10T11:29:59.999Z'))).not.toThrow();expect(()=>validateArrangement(input,new Date('2026-11-10T11:30:00.000Z'))).toThrowError(expect.objectContaining({code:'VALIDATION_FAILED'}));
 expect(()=>validateArrangement({...input,close:{...close,localTime:'11:31'}},new Date('2026-11-10T10:00:00.000Z'))).toThrowError(expect.objectContaining({code:'VALIDATION_FAILED'}));
 expect(()=>validateArrangement(input,new Date('2026-11-10T10:00:00.000Z'))).not.toThrow();
});
it('QA-DB-012 unselected deadline uses actual client suggestion60minutes including previous-day rollover',()=>{
 expect(defaultClose('2026-11-10','12:00')).toEqual({closeDate:'2026-11-10',closeTime:'11:00'});expect(defaultClose('2026-11-10','00:30')).toEqual({closeDate:'2026-11-09',closeTime:'23:30'});
});
