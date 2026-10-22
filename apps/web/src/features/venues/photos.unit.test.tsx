import {useState} from 'react';
import {useLocation} from 'react-router';
import {userEvent} from '@testing-library/user-event';
import {describe,it,expect} from 'vitest';
import {screen,fireEvent,waitFor} from '@testing-library/react';
import {renderWithProviders} from '../../test/render.tsx';
import {createFetchStub,ok,fail} from '../../test/fetchStub.ts';
import {meal,session,VENUE_REF} from '../../test/fixtures.ts';
import type {Meal} from '../../api/types.ts';
import {MealCard} from '../meals/MealCard.tsx';
import {VenuePhoto} from './VenuePhoto.tsx';
const data={placeId:'ChIJ_Dishoom',photo:{uri:'https://lh3.googleusercontent.com/first',source:'Google Maps',authorAttributions:[{displayName:'Photo Author',uri:'https://maps.google.com/maps/contrib/123'}]}};
function ChangingCard(){const[m,setMeal]=useState(meal() as Meal);const l=useLocation();return <><button onClick={()=>setMeal({...m,venue:{...m.venue,venueRef:'77777777-7777-4777-8777-777777777777',placeId:'new-place',name:'New restaurant'}})}>Change restaurant</button><div data-testid="path">{l.pathname}</div><MealCard meal={m}/></>;}
describe('restaurant photos',()=>{
 it('switches venue immediately and ignores old deferred images and author responses',async()=>{
  let resolveOld!:(r:ReturnType<typeof ok>)=>void;const m=meal() as Meal;
  const stub=createFetchStub({getSession:()=>ok(session()),getVenuePhoto:c=>c.params.venueRef===m.venue.venueRef?new Promise(resolve=>{resolveOld=resolve;}):ok({placeId:'new-place',photo:{...data.photo,uri:'https://lh3.googleusercontent.com/new',authorAttributions:[{displayName:'New Author',uri:null}]}})});
  renderWithProviders(<ChangingCard/>,stub.fetch);await waitFor(()=>expect(stub.callsTo('getVenuePhoto')).toHaveLength(1));
  await userEvent.click(screen.getByRole('button',{name:'Change restaurant'}));const image=await screen.findByRole('img',{name:'Restaurant New restaurant'});fireEvent.load(image);
  resolveOld(ok({...data,placeId:m.venue.placeId}));await waitFor(()=>expect(screen.getByText(/New Author/)).toBeTruthy());expect(screen.queryByText('Photo Author')).toBeNull();expect(screen.getByRole('img').getAttribute('src')).toContain('/new');
  expect(JSON.stringify({...sessionStorage})).not.toContain('googleusercontent');
 });
 it('removes an already displayed old image and old attribution as soon as the place changes',async()=>{
  const m=meal() as Meal;let resolveNew!:(r:ReturnType<typeof ok>)=>void;
  const stub=createFetchStub({getSession:()=>ok(session()),getVenuePhoto:c=>c.params.venueRef===m.venue.venueRef?ok({...data,placeId:m.venue.placeId}):new Promise(resolve=>{resolveNew=resolve;})});
  renderWithProviders(<ChangingCard/>,stub.fetch);fireEvent.load(await screen.findByRole('img'));await screen.findByRole('link',{name:'Photo Author'});
  await userEvent.click(screen.getByRole('button',{name:'Change restaurant'}));expect(screen.queryByRole('img')).toBeNull();expect(screen.queryByRole('link',{name:'Photo Author'})).toBeNull();
  resolveNew(ok({placeId:'new-place',photo:null}));expect(await screen.findByLabelText('Restaurant photo unavailable')).toBeTruthy();
 });
 it('author links are independent of the meal hit target and never navigate the SPA to meal detail',async()=>{
  const m=meal() as Meal;const stub=createFetchStub({getSession:()=>ok(session()),getVenuePhoto:()=>ok({...data,placeId:m.venue.placeId})});
  renderWithProviders(<ChangingCard/>,stub.fetch,'/discover');fireEvent.load(await screen.findByRole('img'));const author=await screen.findByRole('link',{name:'Photo Author'});
  expect(author.getAttribute('target')).toBe('_blank');expect(author.closest('a')?.getAttribute('href')).toContain('maps.google.com');await userEvent.click(author);
  expect(screen.getByTestId('path').textContent).toBe('/discover');expect(stub.callsTo('getMeal')).toHaveLength(0);
 });

 it('uses the actual meal restaurant photo and visible mandatory attribution',async()=>{
  const m=meal() as Meal;const stub=createFetchStub({getSession:()=>ok(session()),getVenuePhoto:()=>ok({...data,placeId:m.venue.placeId})});
  renderWithProviders(<MealCard meal={m}/>,stub.fetch);
  const image=await screen.findByRole('img',{name:/Restaurant/});fireEvent.load(image);
  expect((await screen.findByRole('link',{name:'Photo Author'})).getAttribute('href')).toBe(data.photo.authorAttributions[0]!.uri);
  expect(stub.callsTo('getVenuePhoto')[0]!.params).toEqual({venueRef:m.venue.venueRef});
 });
 it('refreshes an expired resource once, then falls back without loops',async()=>{
  const stub=createFetchStub({getSession:()=>ok(session()),getVenuePhoto:()=>ok(data)});
  renderWithProviders(<VenuePhoto venueRef={VENUE_REF} placeId={data.placeId} label="One"/>,stub.fetch);
  fireEvent.error(await screen.findByRole('img'));await waitFor(()=>expect(stub.callsTo('getVenuePhoto')).toHaveLength(2));
  fireEvent.error(await screen.findByRole('img'));expect(await screen.findByLabelText('Restaurant photo unavailable')).toBeTruthy();expect(stub.callsTo('getVenuePhoto')).toHaveLength(2);
 });
 it.each([false,true])('keeps default placeholder for no photographs or provider failure (%s)',async(failure)=>{
  const stub=createFetchStub({getSession:()=>ok(session()),getVenuePhoto:()=>failure?fail(503,'PROVIDER_UNAVAILABLE'):ok({placeId:data.placeId,photo:null})});
  renderWithProviders(<VenuePhoto venueRef={VENUE_REF} placeId={data.placeId} label="One"/>,stub.fetch);
  await waitFor(()=>expect(stub.callsTo('getVenuePhoto')).toHaveLength(1));expect(screen.getByLabelText('Restaurant photo unavailable')).toBeTruthy();
 });
});
