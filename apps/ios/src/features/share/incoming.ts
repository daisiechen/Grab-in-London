import {mealPathFromLink} from '@fancy/client';

/** Only public HTTPS meal links are rewritten. Existing OAuth callback processing stays intact. */
export function incomingMealPath(path:string,origin:string):string{
 const candidate=path.trim();
 if(candidate.startsWith('//'))return '/meal-link-unavailable';
 try{
  const url=new URL(candidate);
  if(url.protocol==='https:'||url.protocol==='http:')return mealPathFromLink(origin,candidate)??'/meal-link-unavailable';
 }catch{if(/^https?:/i.test(candidate))return '/meal-link-unavailable';}
 return path;
}
