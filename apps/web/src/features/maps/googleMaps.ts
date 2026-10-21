/** Minimal SDK boundary. Provider coordinates are transient display data only. */
export interface Bounds {north:number;south:number;east:number;west:number}
export interface Coordinate {lat:number;lng:number}
export interface MapListener {remove():void}
export interface GoogleMapInstance {
  fitBounds(bounds:Bounds):void;
  getBounds():{toJSON():Bounds}|undefined;
  addListener(event:'idle',listener:()=>void):MapListener;
}
export interface GoogleMarkerInstance {map:GoogleMapInstance|null}
export interface GoogleMapsSDK {
  Map:new(element:HTMLElement,options:{center:Coordinate;zoom:number;mapId:string;mapTypeControl:boolean;streetViewControl:boolean;fullscreenControl:boolean;gestureHandling:string})=>GoogleMapInstance;
  marker:{AdvancedMarkerElement:new(options:{map:GoogleMapInstance;position:Coordinate;title:string;content:HTMLElement})=>GoogleMarkerInstance};
}
type SDKWindow=Window&{google?:{maps?:GoogleMapsSDK};__fancyMapsReady?:()=>void;gm_authFailure?:()=>void};
let loading:Promise<GoogleMapsSDK>|null=null;

/** Official direct script loader; one shared request, no third-party wrapper dependency.
 * https://developers.google.com/maps/documentation/javascript/load-maps-js-api */
export function loadGoogleMaps(key:string):Promise<GoogleMapsSDK> {
  const target=window as SDKWindow;
  if(target.google?.maps?.Map&&target.google.maps.marker?.AdvancedMarkerElement)return Promise.resolve(target.google.maps);
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    let settled=false;
    const script=document.createElement('script');
    const previousAuthFailure=target.gm_authFailure;
    const finish=(error?:Error)=>{
      if(settled)return;settled=true;
      clearTimeout(timeout);delete target.__fancyMapsReady;
      if(error&&target.gm_authFailure===authFailure){if(previousAuthFailure)target.gm_authFailure=previousAuthFailure;else delete target.gm_authFailure;}
      if(error){script.remove();loading=null;reject(error);}
      else if(target.google?.maps?.Map&&target.google.maps.marker?.AdvancedMarkerElement)resolve(target.google.maps);
      else {script.remove();loading=null;reject(new Error('Google Maps could not initialise.'));}
    };
    const authFailure=()=>{previousAuthFailure?.();window.dispatchEvent(new Event('fancy:map-auth-failure'));finish(new Error('Google Maps is unavailable. Check the browser key configuration.'));};
    const timeout=setTimeout(()=>finish(new Error('Google Maps took too long to load.')),15000);
    target.__fancyMapsReady=()=>finish();target.gm_authFailure=authFailure;
    script.async=true;
    script.src=`https://maps.googleapis.com/maps/api/js?${new URLSearchParams({key,loading:'async',libraries:'marker',callback:'__fancyMapsReady',v:'quarterly'})}`;
    script.onerror=()=>finish(new Error('Google Maps could not load.'));
    const nonce=document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;if(nonce)script.nonce=nonce;
    document.head.append(script);
  });
  return loading;
}

export function validBounds(value:Bounds):boolean {
  return Object.values(value).every(Number.isFinite)&&value.north>value.south&&value.north<=90&&value.south>=-90&&value.east>value.west&&value.east<=180&&value.west>=-180;
}
export function sameBounds(a:Bounds|null,b:Bounds|null):boolean {
  return a===b||!!a&&!!b&&(['north','south','east','west'] as const).every(k=>Math.abs(a[k]-b[k])<0.000001);
}
