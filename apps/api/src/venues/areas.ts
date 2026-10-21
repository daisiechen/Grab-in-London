import type {Environment} from '@fancy/config';
export type Position=readonly[number,number]; // RFC7946: longitude, latitude.
export type Polygon=readonly(readonly Position[])[];
export interface AreaPolygons {kind:'fixture'|'verified';version:string;revision:number;areas:readonly{areaCode:string;geometry:{type:'Polygon';coordinates:Polygon}|{type:'MultiPolygon';coordinates:readonly Polygon[]}}[]}
export interface AreaMapping {areaCode:string;areaVersion:string|null;areaRevision:number}

const invalid=()=>{throw new Error('INVALID_AREA_POLYGONS');};
function position(raw:unknown):Position{
 if(!Array.isArray(raw)||raw.length!==2||typeof raw[0]!=='number'||typeof raw[1]!=='number'||!Number.isFinite(raw[0])||!Number.isFinite(raw[1])||Math.abs(raw[0])>180||Math.abs(raw[1])>90)return invalid();
 return [raw[0],raw[1]];
}
function side(a:Position,b:Position,p:Position){
 const x=(b[0]-a[0])*(p[1]-a[1]),y=(b[1]-a[1])*(p[0]-a[0]),cross=x-y;
 const tolerance=Number.EPSILON*16*(Math.abs(x)+Math.abs(y));return Math.abs(cross)<=tolerance?0:Math.sign(cross);
}
function onSegment(a:Position,b:Position,p:Position){return side(a,b,p)===0&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);}
function intersects(a:Position,b:Position,c:Position,d:Position){
 const abC=side(a,b,c),abD=side(a,b,d),cdA=side(c,d,a),cdB=side(c,d,b);
 return abC*abD<0&&cdA*cdB<0||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
/** -1 outside, 0 boundary, 1 interior. Holes use the same boundary inclusion rule. */
function inRing(point:Position,ring:readonly Position[]):number{
 let inside=false;
 for(let i=0;i<ring.length-1;i++){
  const a=ring[i]!,b=ring[i+1]!;if(onSegment(a,b,point))return 0;
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside?1:-1;
}
function ringsIntersect(a:readonly Position[],b:readonly Position[]){for(let i=0;i<a.length-1;i++)for(let j=0;j<b.length-1;j++)if(intersects(a[i]!,a[i+1]!,b[j]!,b[j+1]!))return true;return false;}
function ring(raw:unknown):Position[]{
 if(!Array.isArray(raw)||raw.length<4||raw.length>2000)return invalid();const result=raw.map(position);
 const first=result[0]!,last=result.at(-1)!;if(first[0]!==last[0]||first[1]!==last[1])return invalid();
 let area=0,scale=0;
 for(let i=0;i<result.length-1;i++){
  const a=result[i]!,b=result[i+1]!;
  // London datasets need no antimeridian wrapping. Reject uncut crossings rather than misclassify.
  if(a[0]===b[0]&&a[1]===b[1]||Math.abs(a[0]-b[0])>180)return invalid();
  const x=(a[0]-first[0])*(b[1]-first[1]),y=(b[0]-first[0])*(a[1]-first[1]);area+=x-y;scale+=Math.abs(x)+Math.abs(y);
  for(let j=i+2;j<result.length-1;j++)if(!(i===0&&j===result.length-2)&&intersects(a,b,result[j]!,result[j+1]!))return invalid();
 }
 if(Math.abs(area)<=Number.EPSILON*16*scale)return invalid();return result;
}
function polygon(raw:unknown):Polygon{
 if(!Array.isArray(raw)||!raw.length||raw.length>64)return invalid();const rings=raw.map(ring),outer=rings[0]!;
 for(let i=1;i<rings.length;i++){
  const hole=rings[i]!;if(inRing(hole[0]!,outer)!==1||ringsIntersect(outer,hole))return invalid();
  for(let j=1;j<i;j++)if(ringsIntersect(hole,rings[j]!)||inRing(hole[0]!,rings[j]!)!==-1||inRing(rings[j]![0]!,hole)!==-1)return invalid();
 }
 return rings;
}
function contains(point:Position,shape:Polygon){
 const outer=inRing(point,shape[0]!);if(outer<0)return false;if(outer===0)return true;
 for(const hole of shape.slice(1)){const match=inRing(point,hole);if(match===0)return true;if(match===1)return false;}return true;
}
/** RFC7946 geometry only; no provider geometry is retained by the resulting mapping function. */
export function compileAreaPolygons(dataset:AreaPolygons|undefined,environment:Environment){
 if(dataset===undefined)return(location:{lat:number;lng:number}):AreaMapping=>{position([location.lng,location.lat]);return {areaCode:'unknown',areaVersion:null,areaRevision:0};};
 if(!dataset||!['fixture','verified'].includes(dataset.kind)||dataset.kind==='fixture'&&environment!=='test'&&environment!=='development'||typeof dataset.version!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(dataset.version)||!Number.isSafeInteger(dataset.revision)||dataset.revision<1||!Array.isArray(dataset.areas)||dataset.areas.length>256)return invalid();
 const seen=new Set<string>();let points=0;
 const areas=dataset.areas.map(area=>{
  if(!area||typeof area.areaCode!=='string'||area.areaCode.length>64||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(area.areaCode)||area.areaCode==='unknown'||seen.has(area.areaCode)||!area.geometry)return invalid();seen.add(area.areaCode);
  const geometry=area.geometry;let polygons:Polygon[];
  if(geometry.type==='Polygon')polygons=[polygon(geometry.coordinates)];
  else if(geometry.type==='MultiPolygon'&&Array.isArray(geometry.coordinates)&&geometry.coordinates.length&&geometry.coordinates.length<=64)polygons=geometry.coordinates.map(polygon);
  else return invalid();
  for(const shape of polygons)for(const ring of shape)points+=ring.length;if(points>10_000)return invalid();
  return {areaCode:area.areaCode,polygons};
 }).sort((a,b)=>a.areaCode<b.areaCode?-1:a.areaCode>b.areaCode?1:0);
 const version=dataset.version,revision=dataset.revision;
 return(location:{lat:number;lng:number}):AreaMapping=>{const point=position([location.lng,location.lat]);return {areaCode:areas.find(area=>area.polygons.some(shape=>contains(point,shape)))?.areaCode??'unknown',areaVersion:version,areaRevision:revision};};
}
