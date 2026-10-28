import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Image,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import type {ResponseOf} from '@fancy/client';
import {useServices} from '../services.tsx';
import {colors,radius,type} from './tokens.ts';
import {images} from './images.ts';
import {isPreviewMode} from '../platform/preview-mode.ts';
type Photo=NonNullable<ResponseOf<'getVenuePhoto'>['data']['photo']>;
type Props={venueRef:string;placeId:string;name:string;/** Fill the parent (card photo column) instead of the 156pt banner. */fill?:boolean;children?:(parts:{image:ReactNode;attribution:ReactNode})=>ReactNode};
const https=(uri:string|null)=>{try{return uri!==null&&new URL(uri).protocol==='https:';}catch{return false;}};
/** Ephemeral display state only: never enters the app cache, drafts, files or credential storage. */
export function RestaurantPhoto(props:Props){return <PhotoForPlace key={`${props.venueRef}:${props.placeId}`} {...props}/>;}
function PhotoForPlace({venueRef,placeId,name,fill=false,children}:Props){
 const imageStyle=[styles.image,fill&&styles.fill];
 const {api}=useServices();const [photo,setPhoto]=useState<{value:Photo;generation:number}|null>(null);
 const current=useRef({active:false,generation:0,refreshed:false});
 const load=useRef<()=>Promise<void>>(async()=>{});
 useEffect(()=>{
  const scope={active:true,generation:0,refreshed:false};current.current=scope;
  load.current=async()=>{
   const generation=++scope.generation;setPhoto(null);
   if(!venueRef||!placeId||placeId==='unavailable')return;
   try{const result=(await api.call('getVenuePhoto',{params:{venueRef}})).data;
    if(scope.active&&scope===current.current&&scope.generation===generation&&result.placeId===placeId&&result.photo&&https(result.photo.uri))setPhoto({value:result.photo,generation});
   }catch{/* A missing photo never blocks the meal or invents a different restaurant image. */}
  };
  void load.current();return()=>{scope.active=false;};
 },[api,venueRef,placeId]);
 const failed=(generation:number)=>{
  const scope=current.current;if(!scope.active||scope.generation!==generation)return;
  setPhoto(null);if(scope.refreshed)return;scope.refreshed=true;void load.current();
 };
 const image=photo?<Image key={photo.generation} accessibilityLabel={`Photo of ${name}`} style={imageStyle} resizeMode="cover" source={{uri:photo.value.uri,cache:'reload',headers:{'Cache-Control':'no-store'}}} onError={()=>failed(photo.generation)}/>:isPreviewMode()?<Image accessibilityLabel={`Photo of ${name}`} style={imageStyle} resizeMode="cover" source={images.restaurant}/>:<View accessibilityLabel="Restaurant photo unavailable" style={[...imageStyle,styles.placeholder]}><Text style={styles.caption}>Restaurant photo unavailable</Text></View>;
 const attribution=photo?<View style={styles.authors}><Text style={styles.caption}>{photo.value.source}</Text>{photo.value.authorAttributions.map((author,i)=>https(author.uri)?<Pressable key={i} accessibilityRole="link" accessibilityLabel={`Photo by ${author.displayName}`} onPress={()=>{if(current.current.active&&author.uri)void Linking.openURL(author.uri).catch(()=>{});}}><Text style={styles.link}>{author.displayName}</Text></Pressable>:<Text key={i} style={styles.caption}>{author.displayName}</Text>)}</View>:null;
 return children?<>{children({image,attribution})}</>:<View style={styles.container}>{image}{attribution}</View>;
}
const styles=StyleSheet.create({container:{gap:4},image:{height:156,width:'100%',borderRadius:radius.sm},fill:{position:'absolute',top:0,left:0,width:'100%',height:'100%',borderRadius:0},placeholder:{backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.line},authors:{flexDirection:'row',flexWrap:'wrap',gap:8},caption:{fontSize:type.caption,color:colors.muted},link:{fontSize:type.caption,color:colors.forest,textDecorationLine:'underline'}});
