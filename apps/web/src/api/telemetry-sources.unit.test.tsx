import { describe,it,expect } from 'vitest';
import { screen,fireEvent,waitFor,within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { renderApp } from '../test/render.tsx';
import { createFetchStub,ok,page,fail } from '../test/fetchStub.ts';
import { meal,session,publicProfile,MEAL_ID,HOST_ID } from '../test/fixtures.ts';
import { saveDraft } from '../lib/drafts.ts';
import { newDraft } from '../features/create/model.ts';
import { serverValidationMetrics,validationMetric } from '../features/create/validationMetrics.ts';
import { fakePollerDeps } from '../test/fakePoller.ts';

describe('analytics source presentations',()=>{
  it('records actual detail presentation after consent without description or venue display',async()=>{
    const stub=createFetchStub({getSession:()=>ok(session()),getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:null}),ingestEvents:()=>ok({results:[]})});
    renderApp(stub.fetch,`/meals/${MEAL_ID}`);
    await screen.findByRole('heading',{name:'Friday dinner & new faces'});
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await waitFor(()=>expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('detail_view'))).toBe(true));
    const payload=stub.callsTo('ingestEvents').find(c=>JSON.stringify(c.body).includes('detail_view'))?.body as {events:{properties:unknown}[]};
    expect(payload.events[0]?.properties).toEqual({mealId:MEAL_ID});
  });
  it('records a public profile only once it is displayed, without profile text',async()=>{
    const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),getPublicProfile:()=>ok({profile:publicProfile(),reviews:[],nextReviewCursor:null}),ingestEvents:()=>ok({results:[]})});
    renderApp(stub.fetch,`/profiles/${HOST_ID}`);
    await screen.findByRole('heading',{name:'Maya Chen'});
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await waitFor(()=>expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('profile_view'))).toBe(true));
    expect(JSON.stringify(stub.callsTo('ingestEvents').at(-1)?.body)).not.toContain('dumplings');
  });
  it('sends fixed form failure metadata and never advances arranged for an invalid form',async()=>{
    const stub=createFetchStub({getSession:()=>ok(session()),ingestEvents:()=>ok({results:[]})});
    renderApp(stub.fetch,'/create');
    await screen.findByRole('button',{name:/Continue/});
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await waitFor(()=>expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('create_started'))).toBe(true));
    fireEvent.click(screen.getByRole('button',{name:/Continue/}));
    await waitFor(()=>expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('form_error'))).toBe(true));
    const errors=JSON.stringify(stub.callsTo('ingestEvents').find(c=>JSON.stringify(c.body).includes('form_error'))?.body);
    expect(errors).toContain('"field":"venue"');expect(errors).toContain('"errorCode":"required"');
    expect(errors).not.toContain('Choose a restaurant');
    expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('create_arranged'))).toBe(false);
  });
  it('records arranged after actual arrange validation using the persisted business attempt ID',async()=>{
    const m=meal(),draft={...newDraft(),venue:m.venue,date:'2026-10-23',time:'19:30',closeDate:'2026-10-23',closeTime:'18:30'};
    saveDraft('create',draft);
    const stub=createFetchStub({getSession:()=>ok(session()),ingestEvents:()=>ok({results:[]})});
    renderApp(stub.fetch,'/create');
    await screen.findByRole('button',{name:/Continue/});
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await screen.findByRole('button',{name:'Analytics preferences'});
    fireEvent.click(screen.getByRole('button',{name:/Continue/}));
    await waitFor(()=>expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('create_arranged'))).toBe(true));
    expect(JSON.stringify(stub.callsTo('ingestEvents').find(c=>JSON.stringify(c.body).includes('create_arranged'))?.body)).toContain(draft.attemptId);
    expect(stub.callsTo('createMeal')).toHaveLength(0);
  });
  it('records a changed filter only after the result succeeds and excludes raw keyword input',async()=>{
    const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),discoverMeals:()=>page([meal()]),ingestEvents:()=>ok({results:[]})});
    renderApp(stub.fetch);
    await screen.findByRole('heading',{name:'Friday dinner & new faces'});
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await screen.findByRole('button',{name:'Analytics preferences'});
    await userEvent.click(screen.getByRole('button',{name:'More filters'}));
    const dialog=await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('English'));
    await userEvent.type(within(dialog).getByLabelText('Keyword'),'secret-search');
    await userEvent.click(within(dialog).getByRole('button',{name:'Show meals'}));
    await waitFor(()=>expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('filter_applied'))).toBe(true));
    expect(JSON.stringify(stub.callsTo('ingestEvents').map(c=>c.body))).not.toContain('secret-search');
  });
  it('drops unrecognised validation copy rather than sending arbitrary text',()=>{
    expect(validationMetric(MEAL_ID,1,'private user text')).toBeNull();
    expect(serverValidationMetrics(MEAL_ID,{title:'private title text',untrusted:'private unknown text'})).toEqual([{attemptId:MEAL_ID,step:'introduce',field:'title',errorCode:'invalid'}]);
  });
  it('does not treat old visible results as a successful filter result when the new request fails',async()=>{
    const stub=createFetchStub({getSession:()=>fail(401,'AUTH_REQUIRED'),discoverMeals:c=>c.url.searchParams.has('languages')?fail(503,'SERVICE_UNAVAILABLE'):page([meal()]),ingestEvents:()=>ok({results:[]})});
    renderApp(stub.fetch);
    await screen.findByRole('heading',{name:'Friday dinner & new faces'});
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await screen.findByRole('button',{name:'Analytics preferences'});
    await userEvent.click(screen.getByRole('button',{name:'More filters'}));
    const dialog=await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('English'));
    await userEvent.click(within(dialog).getByRole('button',{name:'Show meals'}));
    await screen.findByText('We couldn’t load meals.');
    expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('filter_applied'))).toBe(false);
  });
  it('records an authorised empty group opening without recording messages or fabricating a map view',async()=>{
    const id='14141414-1414-4141-8141-141414141414';
    const conversation={id,version:'1',kind:'GROUP',mealId:MEAL_ID,title:'Friday dinner & new faces',canSend:true,dissolved:false,head:'0'};
    const stub=createFetchStub({getSession:()=>ok(session()),inbox:()=>page([{conversation,lastMessage:null,unreadCount:0}]),getMeal:()=>ok({meal:meal(),myApplication:null,conversationId:id}),readMessages:()=>page([]),ingestEvents:()=>ok({results:[]})});
    renderApp(stub.fetch,`/inbox/${id}`,{pollerDeps:fakePollerDeps().deps});
    await screen.findByLabelText('Message');
    fireEvent.click(screen.getByRole('button',{name:'Allow analytics'}));
    await waitFor(()=>expect(stub.callsTo('ingestEvents').some(c=>JSON.stringify(c.body).includes('chat_opened'))).toBe(true));
    const payload=stub.callsTo('ingestEvents').find(c=>JSON.stringify(c.body).includes('chat_opened'))?.body as {events:{properties:unknown}[]};
    expect(payload.events[0]?.properties).toEqual({conversationId:id});
    expect(JSON.stringify(stub.callsTo('ingestEvents').map(c=>c.body))).not.toContain('map_opened');
  });
});
