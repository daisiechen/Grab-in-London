import {useState} from 'react';
import {expect,it,vi} from 'vitest';
import {screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {renderApp} from '../../test/render.tsx';
import {createFetchStub,ok} from '../../test/fetchStub.ts';
import {meal,session} from '../../test/fixtures.ts';
import {loadDraft,saveDraft} from '../../lib/drafts.ts';
import {newDraft,type MealDraft} from './model.ts';
import type {Venue} from '../../api/types.ts';
// Isolate the verified venue callback boundary; preview must never call parent update.
vi.mock('../venues/VenuePicker.tsx',()=>({VenuePicker:({value,onConfirm}:{value:Venue|null;onConfirm:(venue:Venue)=>void})=>{
 const [preview,setPreview]=useState(false);return <><button onClick={()=>setPreview(true)}>Preview South</button>{preview&&<button onClick={()=>setPreview(false)}>Cancel preview</button>}<button onClick={()=>onConfirm({...value!,placeId:'south',venueRef:'22222222-2222-4222-8222-222222222222',name:'South'})}>Use South</button><button onClick={()=>onConfirm({...value!,venueRef:'77777777-7777-4777-8777-777777777777',name:'Updated display'})}>Refresh same restaurant</button></>;
}}));
function open(venue:Venue|null=meal().venue){
 const draft:MealDraft={...newDraft(),venue:venue?{...venue,placeId:'north'}:null,date:'2026-10-24',time:'18:30',startOffset:60,closeOffset:60,closeDate:'2026-10-24',closeTime:'17:30',title:'Keep my title',description:'Keep all my introduction text.',budgetMin:'20',budgetMax:'40',bookingConfirmed:true,reviewConfirmed:true};
 saveDraft('create',draft);const stub=createFetchStub({getSession:()=>ok(session())});renderApp(stub.fetch,'/create');return draft;
}
it('clears the meeting time and confirmations only when a different verified restaurant is confirmed',async()=>{
 const draft=open();await userEvent.click(await screen.findByRole('button',{name:'Use South'}));
 await waitFor(()=>expect(loadDraft<MealDraft>('create')?.time).toBe(''));
 expect(loadDraft<MealDraft>('create')).toMatchObject({venue:{placeId:'south'},startOffset:null,closeOffset:null,bookingConfirmed:false,reviewConfirmed:false,date:draft.date,title:draft.title,description:draft.description,budgetMin:'20',budgetMax:'40',closeDate:draft.closeDate,closeTime:draft.closeTime});
});
it('preview and cancel preserve the complete existing draft',async()=>{
 open();await userEvent.click(await screen.findByRole('button',{name:'Preview South'}));await userEvent.click(screen.getByRole('button',{name:'Cancel preview'}));expect(loadDraft<MealDraft>('create')).toMatchObject({time:'18:30',startOffset:60,bookingConfirmed:true,reviewConfirmed:true,venue:{placeId:'north'}});
});
it('same-place display refresh preserves time and valid confirmations',async()=>{
 open();await userEvent.click(await screen.findByRole('button',{name:'Refresh same restaurant'}));
 expect(loadDraft<MealDraft>('create')).toMatchObject({time:'18:30',startOffset:60,bookingConfirmed:true,reviewConfirmed:true,venue:{placeId:'north',name:null}});
});
it('initial venue selection keeps a previously entered meeting time',async()=>{
 open(null);await userEvent.click(await screen.findByRole('button',{name:'Use South'}));expect(loadDraft<MealDraft>('create')?.time).toBe('18:30');
});
