import {expect,it} from 'vitest';
import {screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {renderApp} from '../../test/render.tsx';
import {createFetchStub,ok} from '../../test/fetchStub.ts';
import {session,VENUE_REF} from '../../test/fixtures.ts';
import {saveDraft,loadDraft} from '../../lib/drafts.ts';
import {newDraft,type MealDraft} from './model.ts';
it('QA-F16 Back to review returns to Review with the same unsubmitted draft and no create call',async()=>{
 const draft:MealDraft={...newDraft(),venue:{venueRef:VENUE_REF,placeId:'synthetic-place',available:true,name:'Synthetic QA restaurant',address:'Synthetic local address',location:null,areaCode:'soho',attributions:[],displayExpiresAt:null},capacity:4,minimum:3,date:'2026-11-01',time:'19:00',closeDate:'2026-11-01',closeTime:'18:00',title:'Synthetic terms return',description:'Synthetic QA draft that must survive reading cancellation terms.',mood:'EASY_CONVERSATION',languages:['en'],budgetMin:'20',budgetMax:'35',bookingConfirmed:true,reviewConfirmed:false};
 saveDraft('create',draft);const stub=createFetchStub({getSession:()=>ok(session())});renderApp(stub.fetch,'/create');
 for(let step=0;step<3;step++)await userEvent.click(await screen.findByRole('button',{name:'Continue'}));
 await screen.findByRole('heading',{name:'Ready to bring people together?'});await userEvent.click(screen.getByRole('link',{name:'cancellation terms'}));
 await screen.findByRole('heading',{name:'Cancellation terms'});await userEvent.click(screen.getByRole('link',{name:'Back to review'}));
 await screen.findByRole('heading',{name:'Ready to bring people together?'});
 expect(loadDraft<MealDraft>('create')).toMatchObject({title:draft.title,description:draft.description,date:draft.date,time:draft.time,budgetMin:'20',budgetMax:'35',bookingConfirmed:true,reviewConfirmed:false});expect(stub.callsTo('createMeal')).toHaveLength(0);
});
