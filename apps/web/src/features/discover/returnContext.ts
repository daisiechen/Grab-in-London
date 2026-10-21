import {filtersToParams,parseFilters} from './filters.ts';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const selectedCard=(value:string|null)=>value&&uuid.test(value)?value:null;
export const selectedArea=(value:string|null)=>value&&value.length<=64&&/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)?value:null;
export const sourcePageCursor=(value:string|null)=>value&&value.length<=2048&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)?value:null;
/** Only known Discover filters and tiny app-owned UI identifiers may cross a detail/profile route. */
export function discoverReturn(value:unknown):string{
 if(typeof value!=='string'||value.length>8192||!/^\/discover(?:\?[^#]*)?$/.test(value))return '/discover';
 const input=new URLSearchParams(value.split('?')[1]??'');
 const params=filtersToParams(parseFilters(input));
 const view=input.get('view');if(view==='areas'||view==='map')params.set('view',view);
 const area=selectedArea(input.get('area'));if(area)params.set('area',area);
 const selected=selectedCard(input.get('selected'));if(selected){params.set('selected',selected);const cursor=sourcePageCursor(input.get('pageCursor'));if(cursor)params.set('pageCursor',cursor);}
 return '/discover'+(params.size?'?'+params.toString():'');
}
export function mealReturn(value:unknown):string{return value==='/meals?section=HOSTING'?value:discoverReturn(value);}
