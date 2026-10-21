/** Actual router navigation; no mocked Discover/detail components. Controlled API projections only. */
import {it,expect} from 'vitest';
import {screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {createFetchStub,fail,ok,page} from '../../test/fetchStub.ts';
import {renderApp} from '../../test/render.tsx';
import {meal,MEAL_ID,publicProfile} from '../../test/fixtures.ts';
it('QA-DISCOVERY-001 detail Back restores applied filters bounds view and selected area card',async()=>{
 const m=meal({title:'QA Hackney table',areaCode:'hackney'}),other=meal({id:'99999999-9999-4999-8999-999999999999',title:'QA Soho table',areaCode:'soho'});
 const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),discoverMeals:()=>page([m,other]),getMeal:()=>ok({meal:m,myApplication:null}),getPublicProfile:()=>ok({profile:publicProfile(),reviews:[],nextReviewCursor:null})});
 renderApp(stub.fetch,'/discover?view=areas&languages=en&north=51.6&south=51.4&east=0.1&west=-0.3');
 await userEvent.click(await screen.findByRole('button',{name:/Hackney/}));expect(screen.getByRole('heading',{name:'QA Hackney table'})).toBeTruthy();expect(screen.queryByRole('heading',{name:'QA Soho table'})).toBeNull();
 await userEvent.click(screen.getByRole('link',{name:'Open QA Hackney table'}));expect(await screen.findByRole('heading',{name:'QA Hackney table',level:1})).toBeTruthy();expect(stub.callsTo('getMeal')[0]!.params.mealId).toBe(MEAL_ID);
 await userEvent.click(screen.getByRole('link',{name:'Host Maya Chen'}));await screen.findByRole('heading',{name:'Maya Chen'});await userEvent.click(screen.getByRole('link',{name:'Back'}));await screen.findByRole('heading',{name:'QA Hackney table',level:1});
 await userEvent.click(screen.getByRole('link',{name:'Back'}));await screen.findByRole('heading',{name:'Fancy a bite?'});
 expect(screen.getByRole('button',{name:'More filters, 1 active'})).toBeTruthy();expect(screen.getByRole('button',{name:'Areas view'}).getAttribute('aria-pressed')).toBe('true');
 expect(screen.getByRole('heading',{name:'QA Hackney table'})).toBeTruthy();expect(screen.queryByRole('heading',{name:'QA Soho table'})).toBeNull();
 const q=stub.callsTo('discoverMeals').at(-1)!.url.searchParams;expect(q.get('languages')).toBe('en');expect(q.get('north')).toBe('51.6');expect(q.get('south')).toBe('51.4');expect(q.get('east')).toBe('0.1');expect(q.get('west')).toBe('-0.3');
});
