import {expect,it} from 'vitest';
import {compileAreaPolygons,type AreaPolygons,type Polygon} from './areas.ts';
const square=(west:number,south:number,east:number,north:number):Polygon=>[[[west,south],[east,south],[east,north],[west,north],[west,south]]];
const data=(areas:AreaPolygons['areas']):AreaPolygons=>({kind:'fixture',version:'synthetic-v1',revision:1,areas});
it('contains verified points, sorts overlapping/shared boundary by code and returns unknown for no match',()=>{
 const areas=data([{areaCode:'z-area',geometry:{type:'Polygon',coordinates:square(0,0,2,2)}},{areaCode:'a-area',geometry:{type:'Polygon',coordinates:square(2,0,4,2)}}]);
 for(const input of [areas,{...areas,areas:[...areas.areas].reverse()}]){
  const map=compileAreaPolygons(input,'test');expect(map({lng:1,lat:1})).toEqual({areaCode:'z-area',areaVersion:'synthetic-v1',areaRevision:1});expect(map({lng:2,lat:1}).areaCode).toBe('a-area');expect(map({lng:2-1e-9,lat:1}).areaCode).toBe('z-area');expect(map({lng:2+1e-9,lat:1}).areaCode).toBe('a-area');expect(map({lng:2,lat:0}).areaCode).toBe('a-area');expect(map({lng:5,lat:1})).toEqual({areaCode:'unknown',areaVersion:'synthetic-v1',areaRevision:1});
 }
 const overlap=compileAreaPolygons(data([{areaCode:'z-area',geometry:{type:'Polygon',coordinates:square(0,0,3,3)}},{areaCode:'a-area',geometry:{type:'Polygon',coordinates:square(1,1,4,4)}}]),'test');expect(overlap({lng:2,lat:2}).areaCode).toBe('a-area');
});
it('handles polygon holes, includes hole boundary, MultiPolygon islands and orientation-independent closed rings',()=>{
 const polygon=[...square(0,0,4,4),...square(1,1,2,2)];
 const map=compileAreaPolygons(data([{areaCode:'islands',geometry:{type:'MultiPolygon',coordinates:[polygon,square(6,6,7,7)]}}]),'test');
 expect(map({lng:1.5,lat:1.5}).areaCode).toBe('unknown');expect(map({lng:1,lat:1.5}).areaCode).toBe('islands');expect(map({lng:6.5,lat:6.5}).areaCode).toBe('islands');
 const reverse=compileAreaPolygons(data([{areaCode:'reverse',geometry:{type:'Polygon',coordinates:square(0,0,1,1).map(ring=>[...ring].reverse())}}]),'test');expect(reverse({lng:0.5,lat:0.5}).areaCode).toBe('reverse');
});
it('rejects nonfinite coordinates, degenerate/self-intersecting/open rings and malformed/outside holes',()=>{
 const bad:unknown[]=[[[[-179,0],[179,0],[179,1],[-179,1],[-179,0]]],[[[0,0],[1,0],[1,1]]],[[[0,0],[1,0],[2,0],[0,0]]],[[[0,0],[2,2],[0,2],[2,0],[0,0]]],[[[0,0],[1,0],[NaN,1],[0,0]]],[[[0,0],[181,0],[1,1],[0,0]]],[...square(0,0,1,1),...square(2,2,3,3)]];
 for(const coordinates of bad)expect(()=>compileAreaPolygons(data([{areaCode:'bad',geometry:{type:'Polygon',coordinates:coordinates as Polygon}}]),'test')).toThrow();
 const map=compileAreaPolygons(data([{areaCode:'ok',geometry:{type:'Polygon',coordinates:square(0,0,1,1)}}]),'test');for(const point of [{lng:NaN,lat:0},{lng:0,lat:91}])expect(()=>map(point)).toThrow();
});
it('has no default London guess, rejects fixture polygons in production, and copies configuration defensively',()=>{
 expect(compileAreaPolygons(undefined,'production')({lat:51.5,lng:-0.1})).toEqual({areaCode:'unknown',areaVersion:null,areaRevision:0});
 const dataset=data([{areaCode:'synthetic',geometry:{type:'Polygon',coordinates:square(0,0,1,1)}}]);expect(()=>compileAreaPolygons(dataset,'production')).toThrow();
 const map=compileAreaPolygons(dataset,'test');(dataset.areas as unknown as Array<{areaCode:string}>)[0]!.areaCode='mutated';expect(map({lng:0.5,lat:0.5}).areaCode).toBe('synthetic');
});

it('requires registered-sized codes and a positive safe integer revision',()=>{
 const area={areaCode:'a'.repeat(65),geometry:{type:'Polygon' as const,coordinates:square(0,0,1,1)}};expect(()=>compileAreaPolygons(data([area]),'test')).toThrow();
 for(const revision of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])expect(()=>compileAreaPolygons({...data([]),revision},'test')).toThrow();
});

it('rejects duplicate codes, intersecting or nested holes and unknown geometry types',()=>{
 const shape={areaCode:'one',geometry:{type:'Polygon' as const,coordinates:square(0,0,4,4)}};
 expect(()=>compileAreaPolygons(data([shape,shape]),'test')).toThrow();
 for(const holes of [[...square(1,1,3,3),...square(2,2,3.5,3.5)],[...square(1,1,3,3),...square(1.5,1.5,2,2)]])expect(()=>compileAreaPolygons(data([{...shape,geometry:{type:'Polygon',coordinates:[...shape.geometry.coordinates,...holes]}}]),'test')).toThrow();
 expect(()=>compileAreaPolygons(data([{...shape,geometry:{type:'Point',coordinates:[0,0]} as unknown as typeof shape.geometry}]),'test')).toThrow();
});
