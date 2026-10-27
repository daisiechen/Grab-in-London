import { describe,it,expect,vi } from 'vitest';
import { fireEvent,screen,waitFor } from '@testing-library/react';
import { renderApp } from '../test/render.tsx';
import { createFetchStub,fail,ok,page,deferred } from '../test/fetchStub.ts';
import { meal } from '../test/fixtures.ts';

describe('optional analytics',()=>{
  it('defaults to disabled, establishes consent with an empty batch, then refetches discovery with enabled header',async()=>{
    const stub=createFetchStub({getSession:()=>fail(401,'UNAUTHENTICATED'),discoverMeals:()=>page([]),ingestEvents:()=>ok({accepted:0,rejected:[],duplicate:0})});
    renderApp(stub.fetch);
    await screen.findByText('No meals found');
    expect(stub.callsTo('ingestEvents')).toHaveLength(0);
    expect(stub.callsTo('discoverMeals')[0]?.headers['x-fancy-analytics']).toBe('disabled');
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await waitFor(()=>expect(stub.callsTo('discoverMeals').some(c=>c.headers['x-fancy-analytics']==='enabled')).toBe(true));
    expect(stub.callsTo('ingestEvents')[0]?.body).toEqual({schemaVersion:1,consent:{analytics:true,version:'2026-10-21'},events:[]});
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Allow analytics'})).toBeNull());
  });
  it('allows browsing after decline even when withdrawal delivery fails',async()=>{
    const stub=createFetchStub({getSession:()=>fail(401,'UNAUTHENTICATED'),discoverMeals:()=>page([]),ingestEvents:()=>fail(503,'SERVICE_UNAVAILABLE')});
    renderApp(stub.fetch);
    await screen.findByText('No meals found');
    fireEvent.click(screen.getByRole('button',{name:'Decline analytics'}));
    await waitFor(()=>expect(stub.callsTo('ingestEvents')).toHaveLength(1));
    expect((stub.callsTo('ingestEvents')[0]?.body as {consent:{analytics:boolean}}).consent.analytics).toBe(false);
    expect(screen.getByText('No meals found')).toBeTruthy();
    expect(stub.callsTo('discoverMeals').every(c=>c.headers['x-fancy-analytics']==='disabled')).toBe(true);
  });
  it('keeps collection disabled while bootstrap is unresolved',async()=>{
    const pending=deferred<ReturnType<typeof ok>>();
    const stub=createFetchStub({getSession:()=>fail(401,'UNAUTHENTICATED'),discoverMeals:()=>page([]),ingestEvents:()=>pending.promise});
    const {api}=renderApp(stub.fetch);
    await screen.findByText('No meals found');
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await api.client.call('discoverMeals',{query:{}});
    expect(stub.callsTo('discoverMeals').at(-1)?.headers['x-fancy-analytics']).toBe('disabled');
    pending.resolve(ok({accepted:0,rejected:[],duplicate:0}));
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Allow analytics'})).toBeNull());
  });
  it('withdraws immediately and obtains a fresh discovery proof after a later explicit opt-in',async()=>{
    const withdrawal=deferred<ReturnType<typeof ok>>();
    const stub=createFetchStub({getSession:()=>fail(401,'UNAUTHENTICATED'),discoverMeals:()=>page([]),ingestEvents:c=>(c.body as {consent:{analytics:boolean}}).consent.analytics?ok({accepted:0,rejected:[],duplicate:0}):withdrawal.promise});
    const {api}=renderApp(stub.fetch);
    await screen.findByText('No meals found');
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await screen.findByRole('button',{name:'Analytics preferences'});
    fireEvent.click(screen.getByRole('button',{name:'Analytics preferences'}));
    fireEvent.click(screen.getByRole('button',{name:'Decline analytics'}));
    await api.client.call('discoverMeals',{query:{}});
    expect(stub.callsTo('discoverMeals').at(-1)?.headers['x-fancy-analytics']).toBe('disabled');
    withdrawal.resolve(ok({accepted:0,rejected:[],duplicate:0}));
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Allow analytics'})).toBeNull());
    const prior=stub.callsTo('discoverMeals').filter(c=>c.headers['x-fancy-analytics']==='enabled').length;
    fireEvent.click(screen.getByRole('button',{name:'Analytics preferences'}));
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await waitFor(()=>expect(stub.callsTo('discoverMeals').filter(c=>c.headers['x-fancy-analytics']==='enabled').length).toBeGreaterThan(prior));
  });
  it('records only a continuous foreground second at half visibility, bound to the response request ID',async()=>{
    let observe:IntersectionObserverCallback=()=>{};
    class Observer {
      constructor(callback:IntersectionObserverCallback){observe=callback;}
      observe(){} disconnect(){} unobserve(){} takeRecords(){return [];}
      readonly root=null;readonly rootMargin='';readonly thresholds=[0,0.5];
    }
    vi.stubGlobal('IntersectionObserver',Observer);
    // Visibility duration is independent of the calendar date of the shared fixture.
    const base=meal();const future=meal({startsAt:{...base.startsAt,instant:new Date(Date.now()+172800000).toISOString()},closesAt:{...base.closesAt,instant:new Date(Date.now()+86400000).toISOString()}});
    const stub=createFetchStub({getSession:()=>fail(401,'UNAUTHENTICATED'),discoverMeals:()=>({...page([future]),body:{...(page([future]).body as object),meta:{requestId:'99999999-9999-4999-8999-999999999999',serverNow:new Date().toISOString()}}}),ingestEvents:()=>ok({accepted:1,rejected:[],duplicate:0})});
    try {
      renderApp(stub.fetch);
      await screen.findByText('Friday dinner & new faces');
      fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
      await waitFor(()=>expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('discovery_results'))).toBe(true));
      vi.useFakeTimers();
      const visible=(ratio:number)=>observe([{isIntersecting:ratio>0,intersectionRatio:ratio} as IntersectionObserverEntry],{} as IntersectionObserver);
      visible(0.5);vi.advanceTimersByTime(600);visible(0);vi.advanceTimersByTime(1000);
      expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('meal_impression'))).toBe(false);
      visible(0.5);vi.advanceTimersByTime(1000);
      const impressions=stub.callsTo('ingestEvents').filter(c=>JSON.stringify(c.body).includes('meal_impression'));
      expect(impressions).toHaveLength(1);
      expect(JSON.stringify(impressions[0]?.body)).toContain('99999999-9999-4999-8999-999999999999');
      visible(1);vi.advanceTimersByTime(3000);
      expect(stub.callsTo('ingestEvents').filter(c=>JSON.stringify(c.body).includes('meal_impression'))).toHaveLength(1);
    } finally {vi.useRealTimers();vi.unstubAllGlobals();}
  });
});
