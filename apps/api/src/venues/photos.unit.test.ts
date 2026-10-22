import {describe,it,expect,vi} from 'vitest';
import {GooglePlacesProvider} from './google-provider.ts';
const place={id:'place_one',displayName:{text:'One'},formattedAddress:'London',location:{latitude:51.5,longitude:0},types:['restaurant'],businessStatus:'OPERATIONAL',photos:[{name:'places/place_one/photos/fresh',authorAttributions:[{displayName:'Photographer',uri:'https://maps.google.com/maps/contrib/123'}]}]};
describe('fresh Google restaurant photos',()=>{
 it('requests photos in search and details and keeps opaque references transient',async()=>{
  const f=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({places:[place]})));const p=new GooglePlacesProvider('key',f);
  expect((await p.search({q:'One'})).places[0]!.photoRefs).toEqual(['places/place_one/photos/fresh']);
  expect((f.mock.calls[0]![1]?.headers as Record<string,string>)['X-Goog-FieldMask']).toContain('places.photos');
 });
 it.each(['http://lh3.googleusercontent.com/x','https://evil.test/x','https://lh3.googleusercontent.com.evil.test/x','https://u@lh3.googleusercontent.com/x','https://lh3.googleusercontent.com:443/x','https://lh3.googleusercontent.com/x?key=secret-key','https://lh3.googleusercontent.com/secret-key'])('rejects unsafe media URI %s',async uri=>{
  const f=vi.fn<typeof fetch>().mockImplementation(async url=>new Response(JSON.stringify(String(url).includes('/media?')?{photoUri:uri}:place)));
  await expect(new GooglePlacesProvider('secret-key',f).photo('place_one')).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE'});
 });
 it('does not request media without a photo and rejects a different place resource/invalid attribution',async()=>{
  for(const photos of [[],[{name:'places/another/photos/x',authorAttributions:[]}],[{name:'places/place_one/photos/x',authorAttributions:[{displayName:'Author',uri:'javascript:evil'}]}]]){
   const f=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({...place,photos})));const p=new GooglePlacesProvider('key',f);
   expect(await p.photo('place_one')).toBeNull();
   expect(f).toHaveBeenCalledTimes(1);
  }
 });
 it('chooses the first wholly valid same-place photo without dropping any mandatory author',async()=>{
  const invalid={name:'places/another/photos/x',authorAttributions:[]};const f=vi.fn<typeof fetch>().mockImplementation(async url=>new Response(JSON.stringify(String(url).includes('/media?')?{photoUri:'https://lh3.googleusercontent.com/valid'}:{...place,photos:[invalid,...place.photos]})));
  expect((await new GooglePlacesProvider('key',f).photo('place_one'))!.authorAttributions).toEqual([{displayName:'Photographer',uri:'https://maps.google.com/maps/contrib/123'}]);expect(String(f.mock.calls[1]![0])).toContain('/photos/fresh/media');
 });
 it.each([400,404])('expired media %s re-obtains fresh names once within the same read, never caches',async expiredStatus=>{
  let n=0;const f=vi.fn<typeof fetch>().mockImplementation(async url=>{if(String(url).includes('/media?'))return n===1?new Response('{}',{status:expiredStatus}):new Response(JSON.stringify({photoUri:'https://lh3.googleusercontent.com/new'}));n++;return new Response(JSON.stringify({...place,photos:[{name:`places/place_one/photos/fresh${n}`,authorAttributions:[]}]}));});
  const p=new GooglePlacesProvider('key',f);expect((await p.photo('place_one'))!.uri).toContain('/new');expect(f).toHaveBeenCalledTimes(4);
  expect(String(f.mock.calls[1]![0])).toContain('fresh1');expect(String(f.mock.calls[3]![0])).toContain('fresh2');
 });
 it('stops after one fresh-name refresh when media remains expired',async()=>{
  const f=vi.fn<typeof fetch>().mockImplementation(async url=>String(url).includes('/media?')?new Response('{}',{status:404}):new Response(JSON.stringify(place)));
  expect(await new GooglePlacesProvider('key',f).photo('place_one')).toBeNull();expect(f).toHaveBeenCalledTimes(4);
 });
 it.each([301,403,429,500])('does not follow redirects or return usable photos on HTTP %s',async status=>{
  const f=vi.fn<typeof fetch>().mockImplementation(async url=>String(url).includes('/media?')?new Response('{}',{status}):new Response(JSON.stringify(place)));
  await expect(new GooglePlacesProvider('key',f).photo('place_one')).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE'});expect(f.mock.calls[1]![1]?.redirect).toBe('error');
 });

 it('obtains a fresh resource name and author attribution without exposing the server key',async()=>{
  const f=vi.fn<typeof fetch>().mockImplementation(async url=>new Response(JSON.stringify(String(url).includes('/media?')?{photoUri:'https://lh3.googleusercontent.com/restaurant'}:place)));
  const p=new GooglePlacesProvider('secret-key',f);
  expect(await p.photo!('place_one')).toEqual({uri:'https://lh3.googleusercontent.com/restaurant',source:'Google Maps',authorAttributions:[{displayName:'Photographer',uri:'https://maps.google.com/maps/contrib/123'}]});
  await p.photo!('place_one');expect(f).toHaveBeenCalledTimes(4);
  expect(String(f.mock.calls[1]![0])).toContain('skipHttpRedirect=true');
  expect(String(f.mock.calls[1]![0])).not.toContain('secret-key');expect(f.mock.calls[1]![1]?.redirect).toBe('error');
 });
});
