/** Google Places API (New), explicit field masks, no display-content persistence or cache.
 * Official references: https://developers.google.com/maps/documentation/places/web-service/text-search
 * https://developers.google.com/maps/documentation/places/web-service/place-details
 * https://developers.google.com/maps/documentation/places/web-service/policies
 * Photos: https://developers.google.com/maps/documentation/places/web-service/place-photos
 * Resource names and media responses are request-local, never cached or persisted.
 */
import { placesUnavailable, validatePlaceId, validateSearch, type Place, type PlacesProvider, type VenueSearch, type PlacePhoto } from './provider.ts';

const FIELDS = 'id,displayName,formattedAddress,location,types,businessStatus,attributions,photos';
type GooglePhoto={name?:unknown;authorAttributions?:unknown};
type GooglePlace = {photos?:GooglePhoto[]; id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number }; types?: string[]; businessStatus?: string; attributions?: { provider?: string; providerUri?: string }[] };
function parsePlace(p: GooglePlace): Place | null {
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || typeof p.displayName?.text !== 'string' || !p.displayName.text || !Array.isArray(p.types) || !p.types.includes('restaurant') || p.businessStatus !== 'OPERATIONAL') return null;
  const lat = p.location?.latitude, lng = p.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  validatePlaceId(p.id);
  if (p.attributions !== undefined && !Array.isArray(p.attributions)) throw placesUnavailable();
  const thirdParty = (p.attributions ?? []).map((a) => {
    if (!a || typeof a.provider !== 'string' || !a.provider || (a.providerUri !== undefined && typeof a.providerUri !== 'string')) throw placesUnavailable();
    return { provider: 'google' as const, text: [a.provider, a.providerUri].filter(Boolean).join(' ') };
  });
  // Do not silently drop/truncate mandatory third-party attribution to fit the contract.
  if (thirdParty.length > 9 || thirdParty.some((a) => a.text.length > 500)) throw placesUnavailable();
  return { placeId: p.id, name: p.displayName.text.slice(0, 300), address: (typeof p.formattedAddress === 'string' ? p.formattedAddress : '').slice(0, 500), location: { lat, lng }, photoRefs: photoMetadata(p).map(p=>p.name), attributions: [{ provider: 'google' as const, text: 'Google Maps' }, ...thirdParty].slice(0, 10) };
}
function safeLink(value:unknown,hosts:readonly string[],max:number):string|null {
  if(typeof value!=='string'||value.length>max)return null;
  const normalized=value.startsWith('//')?'https:'+value:value;
  if(!/^https:\/\/[^/:?#@]+(?:[/?#]|$)/.test(normalized))return null;
  try{const u=new URL(value.startsWith('//')?'https:'+value:value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&hosts.includes(u.hostname)&&!u.searchParams.has('key')?u.href:null;}catch{return null;}
}
function photoMetadata(p:GooglePlace):{name:string;authorAttributions:PlacePhoto['authorAttributions']}[]{
  if(p.photos===undefined)return [];
  if(!Array.isArray(p.photos)||p.photos.length>10)throw placesUnavailable();
  return p.photos.map(photo=>{
   try{
    if(!photo||typeof photo.name!=='string'||photo.name.length>1000||!new RegExp('^places/'+p.id+'/photos/[A-Za-z0-9_-]+$').test(photo.name))throw placesUnavailable();
    if(!Array.isArray(photo.authorAttributions)||photo.authorAttributions.length>10)throw placesUnavailable();
    const authorAttributions=photo.authorAttributions.map((a:unknown)=>{
      if(!a||typeof a!=='object'||!('displayName'in a)||typeof a.displayName!=='string'||!a.displayName.trim()||a.displayName.length>300)throw placesUnavailable();
      const raw='uri'in a?a.uri:undefined;const uri=raw===undefined?null:safeLink(raw,['maps.google.com','www.google.com'],2000);
      if(raw!==undefined&&!uri)throw placesUnavailable();
      return {displayName:a.displayName,uri};
    });
    return {name:photo.name,authorAttributions};
   }catch{return null;}
  }).filter((photo):photo is {name:string;authorAttributions:PlacePhoto['authorAttributions']}=>photo!==null);
}
export class GooglePlacesProvider implements PlacesProvider {
  readonly kind = 'google' as const;
  private readonly key: string;
  private readonly fetcher: typeof fetch;
  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    if (!apiKey.trim()) throw new Error('Google Places key is required');
    this.key = apiKey;
    this.fetcher = fetcher;
  }
  private async request(path: string, mask: string, body?: unknown,expiredPhoto=false): Promise<unknown | null> {
    try {
      const response = await this.fetcher(`https://places.googleapis.com/v1/${path}`, {
        method: body === undefined ? 'GET' : 'POST', cache:'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { 'X-Goog-Api-Key': this.key, ...(mask?{'X-Goog-FieldMask': mask}:{}), 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if ((response.status === 404 && body === undefined)||(expiredPhoto&&response.status===400)) return null;
      if (!response.ok) throw placesUnavailable();
      return await response.json();
    } catch { throw placesUnavailable(); }
  }
  async photo(placeId:string):Promise<PlacePhoto|null>{
    validatePlaceId(placeId);
    // On an expired media resource, obtain a new name/attributions once. Never retry the old name.
    for(let attempt=0;attempt<2;attempt++){
      const result=await this.request(`places/${encodeURIComponent(placeId)}`,FIELDS) as GooglePlace|null;
      if(!result)return null;
      const place=parsePlace(result);if(!place||place.placeId!==placeId)return null;
      const photo=photoMetadata(result)[0];if(!photo)return null;
      const media=await this.request(`${photo.name}/media?maxWidthPx=800&skipHttpRedirect=true`,'',undefined,true) as {photoUri?:unknown}|null;
      if(!media)continue;
      // Exact host documented in Google's Photos response; no wildcard or arbitrary proxy.
      const uri=safeLink(media.photoUri,['lh3.googleusercontent.com'],4096);
      if(!uri||uri.includes(this.key))throw placesUnavailable();
      return {uri,source:'Google Maps',authorAttributions:photo.authorAttributions};
    }
    return null;
  }

  async search(input: VenueSearch) {
    validateSearch(input);
    const b = input.bounds;
    const result = await this.request('places:searchText', FIELDS.split(',').map((f) => `places.${f}`).join(',') + ',nextPageToken', {
      textQuery: input.q?.trim() ?? 'restaurants in London', includedType: 'restaurant', strictTypeFiltering: true, pageSize: 20,
      ...(b ? { locationRestriction: { rectangle: { low: { latitude: b.south, longitude: b.west }, high: { latitude: b.north, longitude: b.east } } } } : {}),
      ...(input.cursor ? { pageToken: input.cursor } : {}),
    }) as { places?: GooglePlace[]; nextPageToken?: string } | null;
    if (!result || !Array.isArray(result.places ?? [])) throw placesUnavailable();
    return { places: (result.places ?? []).map(parsePlace).filter((p): p is Place => p !== null), nextCursor: typeof result.nextPageToken === 'string' && result.nextPageToken.length > 0 && result.nextPageToken.length <= 2048 ? result.nextPageToken : null };
  }
  async details(placeId: string) {
    validatePlaceId(placeId);
    const result = await this.request(`places/${encodeURIComponent(placeId)}`, FIELDS) as GooglePlace | null;
    if (!result) return null;
    const place = parsePlace(result);
    if (place && place.placeId !== placeId) throw placesUnavailable();
    return place;
  }
}
