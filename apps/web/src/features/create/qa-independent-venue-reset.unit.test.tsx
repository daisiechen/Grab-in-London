/** Current PRD FR05: confirmed different restaurant resets time/declarations, preview does not. */
import {it,expect} from 'vitest';
import {screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {createFetchStub,ok,page} from '../../test/fetchStub.ts';
import {renderApp} from '../../test/render.tsx';
import {session,VENUE_REF} from '../../test/fixtures.ts';
import {saveDraft,loadDraft} from '../../lib/drafts.ts';
import {newDraft,type MealDraft} from './model.ts';
it('QA-CREATE-004 preview preserves old time but explicit different venue confirmation clears time and both declarations',async()=>{
 const original={...newDraft(),venue:{venueRef:VENUE_REF,placeId:'p-north',name:'North',address:'North fixture street',available:true,location:null,areaCode:'soho',attributions:[],displayExpiresAt:null},date:'2026-10-24',time:'18:30',closeDate:'2026-10-24',closeTime:'17:30',title:'Synthetic title retained',description:'A synthetic description retained across venue confirmation.',capacity:6,minimum:6,bookingConfirmed:true,reviewConfirmed:true};saveDraft('create',original);
 const south={placeId:'p-south',name:'South',address:'South fixture street',available:true,location:null,areaCode:'hackney',attributions:[],displayExpiresAt:null};
 const stub=createFetchStub({getSession:()=>ok(session()),searchVenues:()=>page([south]),confirmVenue:()=>ok({venueRef:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',placeId:'p-south',areaCode:'hackney',available:true})});renderApp(stub.fetch,'/create');
 await userEvent.click(await screen.findByRole('button',{name:'Change restaurant'}));
 await userEvent.type(await screen.findByRole('searchbox',{name:'Search restaurants'}),'South');await userEvent.click(screen.getByRole('button',{name:'Search'}));await userEvent.click(await screen.findByRole('button',{name:/^South\s*South fixture street$/}));
 expect(loadDraft<MealDraft>('create')).toMatchObject({time:'18:30',bookingConfirmed:true,reviewConfirmed:true});expect(stub.callsTo('confirmVenue')).toHaveLength(0);
 await userEvent.click(screen.getByRole('button',{name:'Use South'}));await waitFor(()=>expect(loadDraft<MealDraft>('create')?.venue?.placeId).toBe('p-south'));
 expect(loadDraft<MealDraft>('create')).toMatchObject({time:'',bookingConfirmed:false,reviewConfirmed:false,date:original.date,title:original.title,description:original.description,capacity:6,minimum:6});expect(stub.callsTo('createMeal')).toHaveLength(0);
});
