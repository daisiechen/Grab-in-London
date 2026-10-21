/** Independent foreground/visibility boundaries; actual collector with synthetic HTTP transport. */
import {expect,it,vi} from 'vitest';
import {fireEvent,screen,waitFor} from '@testing-library/react';
import {renderApp} from '../test/render.tsx';
import {createFetchStub,fail,ok,page} from '../test/fetchStub.ts';
import {meal} from '../test/fixtures.ts';
it('QA-METRIC-018 49percent/999ms/background interruption emit nothing; continuous50percent1000ms emits once',async()=>{
 let observed:IntersectionObserverCallback=()=>{};
 class Observer{constructor(cb:IntersectionObserverCallback){observed=cb;}observe(){}disconnect(){}unobserve(){}takeRecords(){return [];}readonly root=null;readonly rootMargin='';readonly thresholds=[0,.5];}
 vi.stubGlobal('IntersectionObserver',Observer);const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 const m=meal(),stub=createFetchStub({getSession:()=>fail(401,'UNAUTHENTICATED'),discoverMeals:()=>({...page([m]),body:{...(page([m]).body as object),meta:{requestId:'99999999-9999-4999-8999-999999999999',serverNow:new Date().toISOString()}}}),ingestEvents:()=>ok({results:[]})});
 try{renderApp(stub.fetch);await screen.findByText(m.title);fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));await waitFor(()=>expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('discovery_results'))).toBe(true));vi.useFakeTimers();
 const visible=(ratio:number)=>observed([{isIntersecting:ratio>0,intersectionRatio:ratio} as IntersectionObserverEntry],{} as IntersectionObserver);
 const count=()=>stub.callsTo('ingestEvents').filter(c=>JSON.stringify(c.body).includes('meal_impression')).length;
 visible(.49);vi.advanceTimersByTime(1001);expect(count()).toBe(0);visible(.5);vi.advanceTimersByTime(999);expect(count()).toBe(0);
 visibility.mockReturnValue('hidden');document.dispatchEvent(new Event('visibilitychange'));vi.advanceTimersByTime(2000);expect(count()).toBe(0);
 visibility.mockReturnValue('visible');document.dispatchEvent(new Event('visibilitychange'));vi.advanceTimersByTime(999);expect(count()).toBe(0);vi.advanceTimersByTime(1);expect(count()).toBe(1);
 visible(1);vi.advanceTimersByTime(10000);expect(count()).toBe(1);
 }finally{vi.useRealTimers();visibility.mockRestore();vi.unstubAllGlobals();}
});
it('QA-METRIC-018 closed meal cannot start an impression observer',async()=>{
 const observe=vi.fn();class Observer{observe=observe;disconnect(){}unobserve(){}takeRecords(){return [];}readonly root=null;readonly rootMargin='';readonly thresholds=[0,.5];}
 vi.stubGlobal('IntersectionObserver',Observer);const m=meal({status:'CANCELLED',allowedActions:[]});const stub=createFetchStub({getSession:()=>fail(401,'UNAUTHENTICATED'),discoverMeals:()=>page([m]),ingestEvents:()=>ok({results:[]})});
 try{renderApp(stub.fetch);await screen.findByText(m.title);fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));await screen.findByRole('button',{name:'Analytics preferences'});expect(observe).not.toHaveBeenCalled();expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('meal_impression'))).toBe(false);}finally{vi.unstubAllGlobals();}
});
