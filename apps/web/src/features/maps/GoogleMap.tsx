import { useEffect,useRef,useState } from 'react';
import { useRenderedEvent } from '../../api/telemetry.tsx';
import { loadGoogleMaps,sameBounds,validBounds,type Bounds,type Coordinate,type GoogleMapInstance,type GoogleMapsSDK } from './googleMaps.ts';
import './maps.css';

export interface MapPoint {id:string;title:string;location:Coordinate}
export function GoogleMap({points,selected,onSelect,onSearch,label,appliedBounds=null}:{
  points:MapPoint[];selected:string|null;onSelect:(id:string)=>void;onSearch:(bounds:Bounds)=>void;label:string;appliedBounds?:Bounds|null;
}) {
  const container=useRef<HTMLDivElement>(null),map=useRef<GoogleMapInstance|null>(null),sdk=useRef<GoogleMapsSDK|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[viewport,setViewport]=useState<Bounds|null>(null);
  const key=String(import.meta.env.VITE_PUBLIC_GOOGLE_MAPS_KEY??'').trim();
  const mapId=String(import.meta.env.VITE_PUBLIC_GOOGLE_MAPS_ID??'').trim()||(import.meta.env.DEV?'DEMO_MAP_ID':'');
  const available=!!key&&!!mapId&&(!import.meta.env.PROD||mapId!=='DEMO_MAP_ID');
  useRenderedEvent('map_opened',{},ready);
  useEffect(()=>{
    if(!available||!container.current)return;
    let alive=true,failed=false,listener:{remove():void}|undefined;
    const fail=()=>{failed=true;if(alive){setReady(false);setError('The map is temporarily unavailable. You can keep using the list.');}};
    const timeout=setTimeout(fail,15000);
    window.addEventListener('fancy:map-auth-failure',fail);
    void loadGoogleMaps(key).then(provider=>{
      if(!alive||failed||!container.current)return;
      sdk.current=provider;
      const center=appliedBounds?{lat:(appliedBounds.north+appliedBounds.south)/2,lng:(appliedBounds.east+appliedBounds.west)/2}:{lat:51.5074,lng:-0.1278};
      const instance=new provider.Map(container.current,{center,zoom:13,mapId,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,gestureHandling:'cooperative'});
      if(appliedBounds)instance.fitBounds(appliedBounds);
      map.current=instance;
      listener=instance.addListener('idle',()=>{if(failed)return;const bounds=instance.getBounds()?.toJSON();if(bounds&&validBounds(bounds)){clearTimeout(timeout);setViewport(bounds);setReady(true);}});
    }).catch(fail);
    return()=>{alive=false;clearTimeout(timeout);window.removeEventListener('fancy:map-auth-failure',fail);listener?.remove();map.current=null;sdk.current=null;};
    // The map viewport is deliberately independent of applied search bounds.
  },[available,key,mapId]);
  useEffect(()=>{
    if(!ready||!map.current||!sdk.current)return;
    const markers=points.filter(p=>Number.isFinite(p.location.lat)&&Number.isFinite(p.location.lng)).map(point=>{
      const button=document.createElement('button');button.type='button';button.className=`google-meal-pin${point.id===selected?' selected':''}`;
      button.textContent=point.title;button.setAttribute('aria-label',`Show ${point.title}`);button.setAttribute('aria-pressed',String(point.id===selected));
      const choose=()=>onSelect(point.id);button.addEventListener('click',choose);
      const marker=new sdk.current!.marker.AdvancedMarkerElement({map:map.current!,position:point.location,title:point.title,content:button});
      return {marker,button,choose};
    });
    return()=>{for(const {marker,button,choose}of markers){button.removeEventListener('click',choose);marker.map=null;}};
  },[points,ready,selected,onSelect]);
  if(!available)return <p className="notice">Map unavailable. Browse the list while maps are being set up.</p>;
  return <section className="google-map-wrap" aria-label={label}>
    <div ref={container} className="google-map-canvas" aria-label={label}/>
    {!ready&&!error&&<p role="status">Loading Google Maps…</p>}
    {error&&<p role="status" className="notice">{error}</p>}
    {ready&&viewport&&!sameBounds(viewport,appliedBounds)&&<button type="button" className="google-map-search" onClick={()=>onSearch(viewport)}>Search this area</button>}
  </section>;
}
