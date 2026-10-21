import {describe,expect,it} from 'vitest';
import {render,screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {App} from '../../app/App.tsx';
import {testApi} from '../../test/render.tsx';
import {createFetchStub,ok} from '../../test/fetchStub.ts';
import {HOST_ID,MEAL_ID,meal,publicProfile,session} from '../../test/fixtures.ts';
import {saveDraft} from '../../lib/drafts.ts';
import {newDraft} from '../create/model.ts';

function open(pathname:string,state:unknown){
 const stub=createFetchStub({getSession:()=>ok(session()),getMeal:()=>ok({meal:meal(pathname.endsWith('/edit')?{allowedActions:['EDIT']}:{}),myApplication:null,conversationId:null}),getPublicProfile:()=>ok({profile:publicProfile(HOST_ID,'Maya Chen'),reviews:[],nextReviewCursor:null})});
 render(<MemoryRouter initialEntries={[{pathname,state}]}><App api={testApi(stub.fetch)}/></MemoryRouter>);return stub;
}
describe('source-specific meal and host profile navigation',()=>{
 it('sets the Hosting source after an actual explicit publish flow',async()=>{
  saveDraft('create',{...newDraft(),venue:meal().venue,capacity:4,minimum:2,date:'2026-10-25',time:'19:00',closeDate:'2026-10-25',closeTime:'18:00',title:'A friendly Sunday dinner',description:'Good food and relaxed conversation with new people.',mood:'EASY_CONVERSATION',languages:['en'],budgetMin:'20',budgetMax:'40',bookingConfirmed:true});
  const stub=open('/create',null);stub.on('createMeal',()=>ok(meal(),201));
  for(let i=0;i<3;i++)await userEvent.click(await screen.findByRole('button',{name:/Continue/}));
  await userEvent.click(screen.getByRole('checkbox',{name:/checked the arrangements/}));await userEvent.click(screen.getByRole('button',{name:/Publish meal/}));
  await screen.findByRole('heading',{name:'Friday dinner & new faces'});expect(screen.getByRole('link',{name:'Back'}).getAttribute('href')).toBe('/meals?section=HOSTING');
 });
 it.each([false,true])('sets the Hosting source after editing arrangements (changed=%s)',async(changed)=>{
  const stub=open(`/meals/${MEAL_ID}/edit`,null);stub.on('getMeal',()=>ok({meal:meal({allowedActions:['EDIT']}),myApplication:null,conversationId:null}));stub.on('editMeal',()=>ok(meal()));
  await screen.findByRole('button',{name:'Save changes'});if(changed)await userEvent.type(screen.getByLabelText('Give your meal a name'),'!');
  await userEvent.click(screen.getByRole('button',{name:'Save changes'}));await screen.findByRole('heading',{name:'Friday dinner & new faces'});
  expect(screen.getByRole('link',{name:'Back'}).getAttribute('href')).toBe('/meals?section=HOSTING');
 });
 it('returns a newly published meal detail to Hosting and retains that source through its host profile',async()=>{
  open(`/meals/${MEAL_ID}`,{backTo:'/meals?section=HOSTING'});
  await screen.findByRole('heading',{name:'Friday dinner & new faces'});expect(screen.getByRole('link',{name:'Back'}).getAttribute('href')).toBe('/meals?section=HOSTING');
  await userEvent.click(screen.getByRole('link',{name:'Host Maya Chen'}));await screen.findByRole('heading',{name:'Maya Chen'});
  expect(screen.getByRole('link',{name:'Back'}).getAttribute('href')).toBe(`/meals/${MEAL_ID}`);
  await userEvent.click(screen.getByRole('link',{name:'Back'}));await screen.findByRole('heading',{name:'Friday dinner & new faces'});
  expect(screen.getByRole('link',{name:'Back'}).getAttribute('href')).toBe('/meals?section=HOSTING');
 });
 it('returns an ordinary meal host profile to that meal while keeping the detail Discover fallback',async()=>{
  open(`/meals/${MEAL_ID}`,null);await screen.findByRole('heading',{name:'Friday dinner & new faces'});
  await userEvent.click(screen.getByRole('link',{name:'Host Maya Chen'}));await screen.findByRole('heading',{name:'Maya Chen'});
  expect(screen.getByRole('link',{name:'Back'}).getAttribute('href')).toBe(`/meals/${MEAL_ID}`);
  await userEvent.click(screen.getByRole('link',{name:'Back'}));await screen.findByRole('heading',{name:'Friday dinner & new faces'});expect(screen.getByRole('link',{name:'Back'}).getAttribute('href')).toBe('/discover');
 });
 it.each(['https://outside.invalid','//outside.invalid','/settings/deletion','/meals?section=APPLICATIONS'])('rejects unsupported detail return source %s',async(backTo)=>{
  open(`/meals/${MEAL_ID}`,{backTo});await screen.findByRole('heading',{name:'Friday dinner & new faces'});expect(screen.getByRole('link',{name:'Back'}).getAttribute('href')).toBe('/discover');
 });
 it.each(['https://outside.invalid',`/meals/${MEAL_ID}?redirect=outside`,'/meals/not-a-uuid'])('rejects unsupported public-profile return source %s',async(backTo)=>{
  open(`/profiles/${HOST_ID}`,{backTo});await screen.findByRole('heading',{name:'Maya Chen'});expect(screen.getByRole('link',{name:'Back'}).getAttribute('href')).toBe('/discover');
 });
});
