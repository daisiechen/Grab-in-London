/** Actual Discover and GoogleMap components; controlled SDK boundary only, no real Google request. */
import {afterEach,it,expect,vi} from 'vitest';
import {act,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {createFetchStub,fail,page} from '../../test/fetchStub.ts';
import {renderApp} from '../../test/render.tsx';
import {meal,MEAL_ID} from '../../test/fixtures.ts';
import {loadGoogleMaps,type GoogleMapsSDK,type GoogleMapInstance} from '../maps/googleMaps.ts';
vi.mock('../maps/googleMaps.ts',async()=>({...await vi.importActual('../maps/googleMaps.ts'),loadGoogleMaps:vi.fn()}));
afterEach(()=>vi.unstubAllEnvs());
it('QA-DISCOVERY-001 QA-DISCOVERY-004 two meals not five people share map/list; camera movement and pin preview never open detail automatically',async()=>{
 vi.stubEnv('VITE_PUBLIC_GOOGLE_MAPS_KEY','public-synthetic-qa-no-network');vi.stubEnv('VITE_PUBLIC_GOOGLE_MAPS_ID','synthetic-map-id');
 let idle=()=>{},host:HTMLElement|undefined,viewport={north:51.6,south:51.4,east:0.1,west:-0.3};const created:HTMLElement[]=[];
 class Map {constructor(e:HTMLElement){host=e;}fitBounds(){}addListener(_event:string,cb:()=>void){idle=cb;return{remove(){}};}getBounds(){return{toJSON:()=>viewport};}}
 class Marker {private content:HTMLElement;private current:GoogleMapInstance|null;constructor(o:{map:GoogleMapInstance;content:HTMLElement}){this.content=o.content;this.current=o.map;host?.append(o.content);created.push(o.content);}get map(){return this.current;}set map(v:GoogleMapInstance|null){this.current=v;if(!v)this.content.remove();}}
 vi.mocked(loadGoogleMaps).mockResolvedValue({Map,marker:{AdvancedMarkerElement:Marker}} as GoogleMapsSDK);
 const a=meal({title:'QA map A',capacity:6,confirmedCount:3,venue:{...meal().venue,location:{lat:51.5,lng:-0.1}}}),b=meal({id:'99999999-9999-4999-8999-999999999999',title:'QA map B',capacity:4,confirmedCount:2,venue:{...meal().venue,location:{lat:51.51,lng:-0.11}}});
 const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),discoverMeals:()=>page([a,b])});renderApp(stub.fetch,'/discover?view=map&languages=en&north=51.6&south=51.4&east=0.1&west=-0.3');
 await waitFor(()=>expect(loadGoogleMaps).toHaveBeenCalled());await act(async()=>{idle();});expect(created).toHaveLength(2);expect(screen.getAllByRole('button',{name:/^Show QA map [AB]$/})).toHaveLength(2);
 viewport={...viewport,north:51.7};await act(async()=>{idle();});expect(stub.callsTo('discoverMeals')).toHaveLength(1);expect(stub.callsTo('getMeal')).toHaveLength(0);
 await userEvent.click(screen.getByRole('button',{name:'Show QA map B'}));expect(stub.callsTo('getMeal')).toHaveLength(0);expect(stub.callsTo('confirmVenue')).toHaveLength(0);expect(stub.callsTo('createMeal')).toHaveLength(0);
 await userEvent.click(screen.getByRole('button',{name:'Search this area'}));await waitFor(()=>expect(stub.callsTo('discoverMeals')).toHaveLength(2));expect(stub.callsTo('discoverMeals')[1]!.url.searchParams.get('north')).toBe('51.7');
 await userEvent.click(screen.getByRole('button',{name:'List view'}));expect([screen.getByRole('link',{name:'Open QA map A'}).getAttribute('href'),screen.getByRole('link',{name:'Open QA map B'}).getAttribute('href')].sort()).toEqual([`/meals/${MEAL_ID}`,'/meals/99999999-9999-4999-8999-999999999999'].sort());
});
