import { AnalyticsManager,responseScope } from './manager.ts';
import { createMockFetch,ok,networkDown } from '../test/mock-fetch.ts';
import { deferred,flush } from '../test/deferred.ts';
const scope='a'.repeat(43)+'.'+'b'.repeat(43);
const requestId='11111111-1111-4111-8111-111111111111';
function setup(){
 const mock=createMockFetch();let serial=0;
 let identity={key:'guest:0',ready:true,authenticated:false,accessToken:null as string|null};
 const manager=new AnalyticsManager({baseUrl:'http://api.test',fetch:mock.fetch,identity:()=>identity,newId:()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`,now:()=>Date.parse('2026-10-21T12:00:00Z')});
 return{mock,manager,identity:(next:typeof identity)=>{identity=next;manager.syncIdentity();}};
}
const granted={...ok({results:[]}),headers:{'x-fancy-analytics-scope':scope}};
describe('RAM-only native analytics',()=>{
 it('defaults off and requires an acknowledged empty-batch consent plus a readable signed scope',async()=>{
  const {manager,mock}=setup();mock.on('POST','/v1/analytics/events',granted);
  expect(manager.emit('map_opened',{})).toBe(false);expect(manager.headersFor('discoverMeals')).toEqual({'x-fancy-analytics':'disabled'});
  await manager.choose(true);
  expect(mock.calls[0]?.body).toEqual({schemaVersion:1,consent:{analytics:true,version:'2026-10-21'},events:[]});
  expect(manager.headersFor('discoverMeals')).toEqual({'x-fancy-analytics':'enabled',cookie:`fancy_analytics_scope=${scope}`});
  expect(manager.headersFor('getMeal')).toEqual({'x-fancy-analytics':'disabled'});
 });
 it('fails closed if a successful response exposes neither native scope nor a valid Set-Cookie',async()=>{
  const {manager,mock}=setup();mock.on('POST','/v1/analytics/events',ok({results:[]}));await manager.choose(true);
  expect(manager.getState().enabled).toBe(false);expect(manager.getState().error).toMatch(/protocol/);expect(manager.emit('map_opened',{})).toBe(false);
  const headers={get:(key:string)=>key==='set-cookie'?`fancy_analytics_scope=${scope}; Path=/; HttpOnly`:null} as Headers;
  expect(responseScope(headers)).toBe(scope);
 });
 it('rejects input text, fake result counts and background events; retries keep IDs only within the same epoch',async()=>{
  const {manager,mock}=setup();mock.on('POST','/v1/analytics/events',granted,1).on('POST','/v1/analytics/events',networkDown,1).on('POST','/v1/analytics/events',ok({results:[]}));
  await manager.choose(true);
  expect(manager.emit('discovery_results',{discoveryRequestId:requestId,resultCount:99})).toBe(false);
  expect(manager.emit('form_error',{attemptId:requestId,step:'arrange',field:'venue',errorCode:'required',text:'PRIVATE'})).toBe(false);
  manager.setForeground(false);expect(manager.emit('map_opened',{})).toBe(false);manager.setForeground(true);
  expect(manager.emit('discovery_results',{discoveryRequestId:requestId})).toBe(true);await flush();await manager.flush();
  const batches=mock.calls.slice(1).map(c=>c.body as {events:{eventId:string}[]});expect(batches).toHaveLength(2);expect(batches[0]?.events[0]?.eventId).toBe(batches[1]?.events[0]?.eventId);
 });
 it('disables immediately on withdrawal and discards a late bootstrap after account changes',async()=>{
  const {manager,mock,identity}=setup(),pending=deferred<typeof granted>();
  mock.on('POST','/v1/analytics/events',()=>pending.promise,1).on('POST','/v1/analytics/events',granted);
  const first=manager.choose(true);await flush();identity({key:'user:1',ready:true,authenticated:true,accessToken:'access-only'});
  pending.resolve(granted);await first;expect(manager.getState().enabled).toBe(false);
  await manager.choose(true);const withdrawal=manager.choose(false);expect(manager.headersFor('discoverMeals')).toEqual({'x-fancy-analytics':'disabled'});await withdrawal;
  expect(manager.getState().choice).toBe('declined');expect(manager.emit('map_opened',{})).toBe(false);
 });
 it('caps failed-delivery RAM queue at twenty fixed-metadata events and clears it on session end',async()=>{
  const {manager,mock}=setup();mock.on('POST','/v1/analytics/events',granted,1).on('POST','/v1/analytics/events',networkDown);
  await manager.choose(true);for(let i=0;i<20;i++)expect(manager.emit('map_opened',{})).toBe(true);
  expect(manager.emit('map_opened',{})).toBe(false);await flush();manager.clear();
  expect(manager.getState().enabled).toBe(false);const count=mock.calls.length;await manager.flush();expect(mock.calls).toHaveLength(count);
 });
});
