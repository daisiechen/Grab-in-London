import {View} from 'react-native';
import {Body} from '../../ui/Text.tsx';
export type {MapPoint,Bounds} from './NativeMap.tsx';
/** react-native-maps has no web renderer; the web preview shows the same fallback as a keyless build. */
export function NativeMap(_props:{points:unknown[];onSelect:(id:string)=>void;onMove?:unknown;onReady?:()=>void;label?:string}){
 return <View style={{gap:6}}><Body muted>Map unavailable. Use the restaurant list below.</Body></View>;
}
