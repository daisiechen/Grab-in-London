import { afterEach,describe,it,expect,vi } from 'vitest';
import { act,render,screen,fireEvent,waitFor } from '@testing-library/react';
import { GoogleMap } from './GoogleMap.tsx';
import { loadGoogleMaps,validBounds,type GoogleMapsSDK,type Bounds,type GoogleMapInstance } from './googleMaps.ts';
import { emptyFilters,filtersToParams,filtersToQuery,parseFilters } from '../discover/filters.ts';

vi.mock('./googleMaps.ts',async()=>({...await vi.importActual('./googleMaps.ts'),loadGoogleMaps:vi.fn()}));
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const london:Bounds={north:51.6,south:51.4,east:0.1,west:-0.3};

describe('configured Google Maps boundary (mock SDK evidence)',()=>{
  it('does not request Google scripts when no browser key is configured',()=>{
    vi.stubEnv('VITE_PUBLIC_GOOGLE_MAPS_KEY','');
    render(<GoogleMap points={[]} selected={null} onSelect={()=>{}} onSearch={()=>{}} label="Meal map"/>);
    expect(screen.getByText(/Map unavailable/)).toBeTruthy();
    expect(loadGoogleMaps).not.toHaveBeenCalled();
  });
  it('rejects a demo Map ID in production instead of using a demonstration setup',()=>{
    vi.stubEnv('VITE_PUBLIC_GOOGLE_MAPS_KEY','public-browser-test-key');vi.stubEnv('VITE_PUBLIC_GOOGLE_MAPS_ID','DEMO_MAP_ID');vi.stubEnv('PROD',true);
    render(<GoogleMap points={[]} selected={null} onSelect={()=>{}} onSearch={()=>{}} label="Meal map"/>);
    expect(screen.getByText(/Map unavailable/)).toBeTruthy();expect(loadGoogleMaps).not.toHaveBeenCalled();
  });
  it('keeps camera movement pending until Search this area and independently selects accessible pins',async()=>{
    vi.stubEnv('VITE_PUBLIC_GOOGLE_MAPS_KEY','public-browser-test-key');vi.stubEnv('VITE_PUBLIC_GOOGLE_MAPS_ID','test-map-id');
    let idle=()=>{},host:HTMLElement|undefined,viewport=london;
    const markers:{map:GoogleMapInstance|null}[]=[];
    class Map {
      constructor(element:HTMLElement){host=element;}
      fitBounds(){}
      addListener(_event:string,callback:()=>void){idle=callback;return {remove:()=>{}};}
      getBounds(){return {toJSON:()=>viewport};}
    }
    class Marker {map:GoogleMapInstance|null;constructor(options:{map:GoogleMapInstance;content:HTMLElement}){this.map=options.map;host?.append(options.content);markers.push(this);}}
    vi.mocked(loadGoogleMaps).mockResolvedValue({Map,marker:{AdvancedMarkerElement:Marker}} as GoogleMapsSDK);
    const choose=vi.fn(),search=vi.fn();
    const view=render(<GoogleMap points={[{id:'meal-1',title:'Dinner',location:{lat:51.5,lng:-0.1}}]} selected={null} onSelect={choose} onSearch={search} label="Meal map" appliedBounds={london}/>);
    await waitFor(()=>expect(loadGoogleMaps).toHaveBeenCalled());
    await act(async()=>{idle();});
    expect(screen.queryByRole('button',{name:'Search this area'})).toBeNull();
    viewport={...london,north:51.7};await act(async()=>{idle();});
    expect(search).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Show Dinner'}));expect(choose).toHaveBeenCalledWith('meal-1');expect(search).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Search this area'}));expect(search).toHaveBeenCalledWith(viewport);
    view.unmount();expect(markers.every(marker=>marker.map===null)).toBe(true);
  });
  it('round-trips explicit bounds and clears them while preserving other applied filters',()=>{
    const filters={...emptyFilters,bounds:london,languages:['en' as const]};
    expect(filtersToQuery(filters)).toEqual({...london,languages:'en'});
    expect(parseFilters(filtersToParams(filters))).toEqual(filters);
    expect(filtersToParams({...filters,bounds:null},filtersToParams(filters)).has('north')).toBe(false);
    expect(validBounds({...london,north:NaN})).toBe(false);
    expect(parseFilters(new URLSearchParams('north=52&south=51')).bounds).toBeNull();
  });
  it('shows an unavailable state when provider authentication fails after script loading',async()=>{
    vi.stubEnv('VITE_PUBLIC_GOOGLE_MAPS_KEY','public-browser-test-key');vi.stubEnv('VITE_PUBLIC_GOOGLE_MAPS_ID','test-map-id');
    let idle=()=>{};
    class Map {fitBounds(){} addListener(_event:string,callback:()=>void){idle=callback;return {remove:()=>{}};}getBounds(){return {toJSON:()=>london};}}
    class Marker {map:GoogleMapInstance|null=null;}
    vi.mocked(loadGoogleMaps).mockResolvedValue({Map,marker:{AdvancedMarkerElement:Marker}} as GoogleMapsSDK);
    render(<GoogleMap points={[]} selected={null} onSelect={()=>{}} onSearch={()=>{}} label="Meal map"/>);
    await waitFor(()=>expect(loadGoogleMaps).toHaveBeenCalled());
    await act(async()=>{window.dispatchEvent(new Event('fancy:map-auth-failure'));idle();});
    expect(screen.getByText(/map is temporarily unavailable/)).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Search this area'})).toBeNull();
  });
});
