import {useEffect,useState} from 'react';
import type {ResponseOf} from '@fancy/client';
import {useApi} from '../../api/ApiProvider.tsx';
type Photo=ResponseOf<'getVenuePhoto'>['data']['photo'];
/** Request-local provider data: never written to drafts, storage, query cache or telemetry. */
export function VenuePhoto({venueRef,placeId,label,className}:{venueRef:string;placeId:string;label:string|null;className?:string|undefined}){
 return <PhotoForVenue key={`${venueRef}:${placeId}`} {...{venueRef,placeId,label,className}}/>;
}
function PhotoForVenue({venueRef,placeId,label,className}:{venueRef:string;placeId:string;label:string|null;className?:string|undefined}){
 const {api}=useApi();const[photo,setPhoto]=useState<Photo>(null);const[refresh,setRefresh]=useState(0);const[loaded,setLoaded]=useState(false);const[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;setPhoto(null);setLoaded(false);setFailed(false);
  void api.client.call('getVenuePhoto',{params:{venueRef}}).then(result=>{if(active&&result.data.placeId===placeId)setPhoto(result.data.photo);}).catch(()=>{if(active)setPhoto(null);});
  return()=>{active=false;};
 },[api,venueRef,placeId,refresh]);
 return <div className={className} style={{position:'relative',overflow:'hidden',display:'flex',flexDirection:'column',height:'auto'}}>
  {photo&&!failed?<>
   <div style={{position:'relative',width:'100%',height:className==='detail-hero'?150:130,flexShrink:0}}>
    <img src={photo.uri} alt={`Restaurant ${label??''}`.trim()} referrerPolicy="no-referrer" loading="lazy" style={{position:'absolute',inset:0,display:'block',width:'100%',height:'100%',objectFit:'cover'}} onLoad={()=>setLoaded(true)} onError={()=>{setLoaded(false);setFailed(true);if(refresh===0)setRefresh(1);}}/>
   </div>
   {loaded?<div className="attribution" style={{position:'relative',zIndex:2,background:'var(--surface, white)',fontSize:11,lineHeight:1.4,padding:3,overflowWrap:'anywhere'}}>
    <span>{photo.source}</span>{photo.authorAttributions.map((a,i)=><span key={i}> · {a.uri?<a href={a.uri} target="_blank" rel="noopener noreferrer">{a.displayName}</a>:a.displayName}</span>)}
   </div>:null}
  </>:<span aria-label="Restaurant photo unavailable" style={{margin:'auto'}}>{(label??'Restaurant').slice(0,2).toUpperCase()}</span>}
 </div>;
}
