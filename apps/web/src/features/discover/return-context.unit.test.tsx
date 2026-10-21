import {expect,it} from 'vitest';
import {screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {renderApp} from '../../test/render.tsx';
import {createFetchStub,fail,ok,page} from '../../test/fetchStub.ts';
import {discoverReturn} from './returnContext.ts';
import {HOST_ID,MEAL_ID,meal,publicProfile} from '../../test/fixtures.ts';
it.each(['list','areas','map'])('returns to the applied Discover filters and %s context through meal and host profile',async(view)=>{
 const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),discoverMeals:()=>page([meal()]),getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:null}),getPublicProfile:()=>ok({profile:publicProfile(HOST_ID,'Maya Chen'),reviews:[],nextReviewCursor:null})});
 renderApp(stub.fetch,`/discover?languages=en&view=${view}`);
 if(view==='areas')await userEvent.click(await screen.findByRole('button',{name:/Soho/}));
 await userEvent.click(await screen.findByRole('link',{name:'Open Friday dinner & new faces'}));
 await screen.findByRole('heading',{name:'Friday dinner & new faces'});
 const before=new URL(screen.getByRole('link',{name:'Back'}).getAttribute('href')!,'http://test');
 expect(before.pathname).toBe('/discover');expect(before.searchParams.get('languages')).toBe('en');expect(before.searchParams.get('selected')).toBe(MEAL_ID);
 await userEvent.click(screen.getByRole('link',{name:'Host Maya Chen'}));await screen.findByRole('heading',{name:'Maya Chen'});
 await userEvent.click(screen.getByRole('link',{name:'Back'}));await screen.findByRole('heading',{name:'Friday dinner & new faces'});
 expect(screen.getByRole('link',{name:'Back'}).getAttribute('href')).toBe(before.pathname+before.search);
 await userEvent.click(screen.getByRole('link',{name:'Back'}));
 expect(await screen.findByRole('link',{name:'Open Friday dinner & new faces'})).toBeTruthy();
 expect(stub.callsTo('discoverMeals').every(c=>c.url.searchParams.get('languages')==='en')).toBe(true);
 if(view==='areas')expect(screen.getByRole('button',{name:/Soho/}).getAttribute('aria-pressed')).toBe('true');
});

it.each(['https://evil.example/discover?languages=en','//evil.example/discover','/discover/other?languages=en','/discover?languages=en#outside','/settings/deletion'])('rejects unsupported Discover source %s',value=>{
 expect(discoverReturn(value)).toBe('/discover');
});
it('canonicalizes only supported filter/UI values and retains validated viewport bounds',()=>{
 const value=discoverReturn('/discover?languages=en,invalid&view=map&area=soho&selected='+MEAL_ID+'&north=52&south=51&east=0&west=-1&redirect=https://evil.example&providerName=secret');
 const params=new URL(value,'http://test').searchParams;
 expect(Object.fromEntries(params)).toEqual({north:'52',south:'51',east:'0',west:'-1',languages:'en',view:'map',area:'soho',selected:MEAL_ID});
 expect(discoverReturn('/discover?view=outside&area=../private&selected=not-uuid&north=NaN')).toBe('/discover');
});
const cursor='fixturePage.'+'a'.repeat(43);
it('restores a selected later-page card through its signed source cursor and continues from that page',async()=>{
 const other=meal({id:'44444444-4444-4444-8444-444444444444',title:'First page table'});
 const next='nextPage.'+'b'.repeat(43);
 const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),discoverMeals:c=>c.url.searchParams.get('cursor')===cursor?page([meal()],next):c.url.searchParams.get('cursor')===next?page([meal({id:'55555555-5555-4555-8555-555555555555',title:'Third page table'})]):page([other],cursor),getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:null})});
 renderApp(stub.fetch,'/discover?languages=en');await screen.findByRole('link',{name:'Open First page table'});
 await userEvent.click(screen.getByRole('button',{name:'Show more meals'}));await userEvent.click(await screen.findByRole('link',{name:'Open Friday dinner & new faces'}));
 await screen.findByRole('heading',{name:'Friday dinner & new faces'});
 expect(new URL(screen.getByRole('link',{name:'Back'}).getAttribute('href')!,'http://test').searchParams.get('pageCursor')).toBe(cursor);
 await userEvent.click(screen.getByRole('link',{name:'Back'}));await screen.findByRole('link',{name:'Open Friday dinner & new faces'});
 expect(screen.queryByRole('link',{name:'Open First page table'})).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'Show more meals'}));await screen.findByRole('link',{name:'Open Third page table'});
 expect(stub.callsTo('discoverMeals').map(c=>c.url.searchParams.get('cursor'))).toEqual([null,cursor,cursor,next]);
 expect(stub.callsTo('discoverMeals').every(c=>c.url.searchParams.get('languages')==='en')).toBe(true);
});
it.each(['expired','removed'])('falls back once to the current first page when the selected source is %s',async(reason)=>{
 const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),discoverMeals:c=>c.url.searchParams.has('cursor')?(reason==='expired'?fail(422,'VALIDATION_FAILED'):page([])):page([meal()])});
 renderApp(stub.fetch,`/discover?languages=en&selected=${MEAL_ID}&pageCursor=${cursor}`);
 await screen.findByRole('link',{name:'Open Friday dinner & new faces'});
 expect(stub.callsTo('discoverMeals').map(c=>c.url.searchParams.get('cursor'))).toEqual([cursor,null]);
});
it('does not hide a source-page service outage behind an unfiltered fallback',async()=>{
 const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),discoverMeals:()=>fail(503,'PROVIDER_UNAVAILABLE')});
 renderApp(stub.fetch,`/discover?languages=en&selected=${MEAL_ID}&pageCursor=${cursor}`);
 await screen.findByRole('heading',{name:'We couldn’t load meals.'});
 expect(stub.callsTo('discoverMeals').every(c=>c.url.searchParams.get('cursor')===cursor)).toBe(true);
});
it('keeps an offline source-page failure visible without querying the first page',async()=>{
 const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),discoverMeals:()=>{throw new TypeError('offline');}});
 renderApp(stub.fetch,`/discover?languages=en&selected=${MEAL_ID}&pageCursor=${cursor}`);
 await screen.findByRole('heading',{name:'We couldn’t load meals.'});
 expect(screen.getByRole('alert').textContent).toContain('offline');
 expect(stub.callsTo('discoverMeals').every(c=>c.url.searchParams.get('cursor')===cursor)).toBe(true);
});
