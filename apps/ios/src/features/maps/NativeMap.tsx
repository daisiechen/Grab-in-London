import Constants from 'expo-constants';
import {StyleSheet,View,UIManager} from 'react-native';
import MapView,{Marker,PROVIDER_GOOGLE,type Region} from 'react-native-maps';
import {Body} from '../../ui/Text.tsx';
export interface MapPoint {id:string;title:string;lat:number;lng:number;attributions?:string[]}
export interface Bounds {north:number;south:number;east:number;west:number}
export const LONDON_REGION:Region={latitude:51.513,longitude:-0.125,latitudeDelta:0.16,longitudeDelta:0.22};
export function regionBounds(r:Region):Bounds{return {north:Math.min(90,r.latitude+r.latitudeDelta/2),south:Math.max(-90,r.latitude-r.latitudeDelta/2),east:wrap(r.longitude+r.longitudeDelta/2),west:wrap(r.longitude-r.longitudeDelta/2)};}
function wrap(lng:number){return ((lng+180)%360+360)%360-180;}
/** Google Places content requires the Google native provider and a restricted public iOS key. */
export function NativeMap({points,onSelect,onMove,onReady,label='Meal map'}:{points:MapPoint[];onSelect:(id:string)=>void;onMove?:(bounds:Bounds)=>void;onReady?:()=>void;label?:string}){
 const available=Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY)&&Constants.executionEnvironment!=='storeClient'&&Boolean(UIManager.getViewManagerConfig('AIRGoogleMap'));
 if(!available)return <View style={{gap:6}}><Body muted>Map unavailable. Use the restaurant list below.</Body><Body muted>Google Maps</Body>{[...new Set(points.flatMap(p=>p.attributions??[]))].map(text=><Body key={text} muted>{text}</Body>)}</View>;
 const first=points[0];const region=first?{...LONDON_REGION,latitude:first.lat,longitude:first.lng}:LONDON_REGION;
 return <View style={{gap:6}}>
  <MapView provider={PROVIDER_GOOGLE} testID="native-map" accessibilityLabel={label} style={styles.map} initialRegion={region} showsUserLocation={false} showsMyLocationButton={false} onMapReady={()=>onReady?.()} onRegionChangeComplete={r=>onMove?.(regionBounds(r))}>
   {points.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng)).map(p=><Marker key={p.id} testID={`map-pin-${p.id}`} identifier={p.id} coordinate={{latitude:p.lat,longitude:p.lng}} title={p.title} accessibilityLabel={p.title} onPress={()=>onSelect(p.id)}/>) }
  </MapView>
  {points.some(p=>p.attributions?.length)?<Body muted>Google Maps</Body>:null}
  {[...new Set(points.flatMap(p=>p.attributions??[]))].map(text=><Body key={text} muted>{text}</Body>)}
 </View>;
}
const styles=StyleSheet.create({map:{height:270,width:'100%',borderRadius:11}});
