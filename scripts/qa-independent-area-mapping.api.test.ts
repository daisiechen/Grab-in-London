/** Independent synthetic geometry and actual confirmation persistence, no licensed London coverage claim. */
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {loadConfig} from '../packages/config/src/index.ts';
import {Browser,createHarness,json,WEB_ORIGIN,type Harness} from '../apps/api/src/test/harness.ts';
import {buildServer} from '../apps/api/src/http/server.ts';
import {compileAreaPolygons,type AreaPolygons,type Polygon} from '../apps/api/src/venues/areas.ts';
const box=(left:number,right:number,bottom=0,top=1):Polygon=>[[[left,bottom],[right,bottom],[right,top],[left,top],[left,bottom]]];
const dataset:AreaPolygons={kind:'fixture',version:'qa-independent-v1',revision:1,areas:[{areaCode:'zeta',geometry:{type:'Polygon',coordinates:box(1,2)}},{areaCode:'alpha',geometry:{type:'Polygon',coordinates:box(0,1)}}]};
it('QA-DISCOVERY-009 unsorted overlap/shared border/vertex chooses lexical alpha; interior zeta and outside unknown',()=>{
 const map=compileAreaPolygons(dataset,'test');for(const p of [{lng:1,lat:.5},{lng:1,lat:0}])expect(map(p).areaCode).toBe('alpha');expect(map({lng:1.5,lat:.5}).areaCode).toBe('zeta');expect(map({lng:3,lat:.5})).toEqual({areaCode:'unknown',areaVersion:'qa-independent-v1',areaRevision:1});
});
it('QA-DISCOVERY-009 holes exclude interior, MultiPolygon includes separate island and malformed/fixture-production input fails closed',()=>{
 const outer=box(0,4,0,4)[0]!,hole=box(1,2,1,2)[0]!;const map=compileAreaPolygons({...dataset,areas:[{areaCode:'islands',geometry:{type:'MultiPolygon',coordinates:[[outer,hole],box(10,11,10,11)]}}]},'test');
 expect(map({lng:1.5,lat:1.5}).areaCode).toBe('unknown');expect(map({lng:10.5,lat:10.5}).areaCode).toBe('islands');expect(()=>map({lng:NaN,lat:1})).toThrow();expect(()=>compileAreaPolygons(dataset,'production')).toThrow();
 expect(compileAreaPolygons(undefined,'test')({lng:.5,lat:.5})).toEqual({areaCode:'unknown',areaVersion:null,areaRevision:0});
});
let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));await h.app.close();h.app=await buildServer({pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN,config:loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'mock',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'}),areaPolygons:dataset,placesProvider:{kind:'fixture',search:async()=>({places:[],nextCursor:null}),details:async(placeId)=>({placeId,name:'PROVIDER_PRIVATE_DISPLAY_CANARY',address:'DO_NOT_PERSIST_ADDRESS',location:{lng:1,lat:.5},photoRefs:[],attributions:[]})}});});
afterAll(async()=>{await h.app.close();await h.db.drop();});
it('QA-DISCOVERY-009 actual HTTP confirm maps only verified provider point and persists app-owned code/version without geometry/display',async()=>{
 const b=new Browser(h);await b.signInWithEmail(`${randomUUID()}@example.invalid`);const r=await b.request('POST','/v1/venues/confirm',{body:{placeId:'qa_independent_boundary'},headers:{'idempotency-key':randomUUID()}});expect(r.statusCode,r.body).toBe(200);expect(json(r).data.areaCode).toBe('alpha');const row=(await h.db.pool.query('SELECT * FROM venues WHERE id=$1',[json(r).data.venueRef])).rows[0];expect(row).toMatchObject({area_code:'alpha',area_version:'qa-independent-v1',area_revision:'1'});expect(JSON.stringify(row)).not.toMatch(/PROVIDER_PRIVATE_DISPLAY_CANARY|DO_NOT_PERSIST_ADDRESS|"lat"|"lng"/);
});
