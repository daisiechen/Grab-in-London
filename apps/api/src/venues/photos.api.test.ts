import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it,vi} from 'vitest';
import {loadConfig} from '@fancy/config';
import {buildServer} from '../http/server.ts';
import {Browser,createHarness,json,WEB_ORIGIN,type Harness} from '../test/harness.ts';
import {GooglePlacesProvider} from './google-provider.ts';
let h:Harness;let noPhoto=false;let mediaStatus=200;let detailsCount=0;
const f=vi.fn<typeof fetch>().mockImplementation(async input=>{
 const url=String(input);if(url.includes('/media?'))return new Response(JSON.stringify({photoUri:'https://lh3.googleusercontent.com/PHOTO_CANARY'}),{status:mediaStatus});
 detailsCount++;const id=decodeURIComponent(url.split('/places/')[1]!);
 return new Response(JSON.stringify({id,displayName:{text:'PROVIDER_NAME_CANARY'},formattedAddress:'PROVIDER_ADDRESS_CANARY',location:{latitude:51.5,longitude:0},types:['restaurant'],businessStatus:'OPERATIONAL',photos:noPhoto?[]:[{name:`places/${id}/photos/fresh${detailsCount}`,authorAttributions:[{displayName:'AUTHOR_CANARY',uri:'https://maps.google.com/maps/contrib/123'}]}]}));
});
beforeAll(async()=>{
 h=await createHarness(inject('pgServerUrl'));await h.app.close();
 const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:h.db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'google',GOOGLE_MAPS_API_KEY:'private-photo-key',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN,SESSION_SECRET:'api-test-session-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'});
 h.app=await buildServer({config,pool:h.db.pool,identity:h.idp,publicOrigin:WEB_ORIGIN,placesProvider:new GooglePlacesProvider('private-photo-key',f)});
});
afterAll(async()=>h.close());
it('public exact venue reference resolves fresh photos without retaining names/authors/URI or key',async()=>{
 const b=new Browser(h);await b.signInWithEmail(`${randomUUID()}@example.invalid`);
 const confirm=await b.request('POST','/v1/venues/confirm',{body:{placeId:'place_photo'},headers:{'idempotency-key':randomUUID()}});expect(confirm.statusCode,confirm.body).toBe(200);const ref=json(confirm).data.venueRef;
 const callsBefore=f.mock.calls.length;expect((await h.app.inject({method:'GET',url:`/v1/venues/${ref}/photo?url=https://evil.test`})).statusCode).toBe(422);expect(f).toHaveBeenCalledTimes(callsBefore);
 const before=detailsCount;const first=await h.app.inject({method:'GET',url:`/v1/venues/${ref}/photo`});expect(first.statusCode,first.body).toBe(200);expect(first.headers['cache-control']).toContain('no-store');expect(json(first).data).toMatchObject({placeId:'place_photo',photo:{uri:'https://lh3.googleusercontent.com/PHOTO_CANARY',source:'Google Maps',authorAttributions:[{displayName:'AUTHOR_CANARY'}]}});
 expect(first.body).not.toContain('private-photo-key');expect(first.body).not.toContain('photos/fresh');
 await h.app.inject({method:'GET',url:`/v1/venues/${ref}/photo`});expect(detailsCount).toBe(before+2);
 const rows=await h.db.pool.query('SELECT * FROM venues WHERE id=$1',[ref]);const intents=await h.db.pool.query("SELECT response_json FROM idempotency WHERE operation='confirmVenue'");for(const canary of ['AUTHOR_CANARY','PHOTO_CANARY','PROVIDER_NAME_CANARY','PROVIDER_ADDRESS_CANARY','photos/fresh'])expect(JSON.stringify([rows.rows,intents.rows])).not.toContain(canary);
 mediaStatus=404;const expired=await h.app.inject({method:'GET',url:`/v1/venues/${ref}/photo`});expect(json(expired).data.photo).toBeNull();mediaStatus=200;
 noPhoto=true;expect(json(await h.app.inject({method:'GET',url:`/v1/venues/${ref}/photo`})).data.photo).toBeNull();noPhoto=false;
 mediaStatus=429;const error=await h.app.inject({method:'GET',url:`/v1/venues/${ref}/photo`});expect(error.statusCode).toBe(503);expect(error.headers['cache-control']).toContain('no-store');mediaStatus=200;
});
it('unknown refs, malformed UUID and extra photo URL input cannot cause a provider request',async()=>{
 const before=f.mock.calls.length;
 for(const url of [`/v1/venues/${randomUUID()}/photo`,'/v1/venues/notuuid/photo',`/v1/venues/${randomUUID()}/photo?url=https://evil.test`]){
  const response=await h.app.inject({method:'GET',url});expect([404,422]).toContain(response.statusCode);
 }
 expect(f).toHaveBeenCalledTimes(before);
});
