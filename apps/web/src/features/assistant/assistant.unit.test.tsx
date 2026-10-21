/** Mock transport UI evidence only; never a real-model or external-provider acceptance claim. */
import {useState} from 'react';
import {act,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {describe,expect,it,vi} from 'vitest';
import {renderWithProviders} from '../../test/render.tsx';
import {createFetchStub,fail,noContent,ok,deferred,type StubResponse} from '../../test/fetchStub.ts';
import {fakePollerDeps} from '../../test/fakePoller.ts';
import {PollerDepsContext} from '../../lib/pollerContext.tsx';
import {MEAL_ID,session as userSession} from '../../test/fixtures.ts';
import {AssistantProvider,useAssistantEditor} from './context.tsx';
import {AssistantLauncher} from './AssistantLauncher.tsx';
import {AssistantPanel} from './AssistantPanel.tsx';
import {emptyFields,type AIDraft,type AIResult} from './model.ts';
const SID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',DID='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const aiSession=()=>({sessionId:SID,generation:1,deviceToken:'d'.repeat(43),revokeHandle:'r'.repeat(43),expiresAt:new Date(Date.now()+1_800_000).toISOString()});
const result=(patch:Partial<AIResult>={}):AIResult=>({replyText:'Here is a suggestion for you to review.',cards:[],...patch});
const status=(requestId:string,done=true,output=result())=>({requestId,sessionId:SID,generation:1,state:done?'SUCCEEDED':'PENDING',deadline:new Date(Date.now()+30_000).toISOString(),result:done?output:null,errorCode:null});
const draft=():AIDraft=>({id:DID,kind:'APPLICATION',targetId:MEAL_ID,targetVersion:'1',editorVersion:'0',createdAt:new Date().toISOString(),text:'I would enjoy joining your table and meeting everyone.',fields:null});
function baseStub(){return createFetchStub({getSession:()=>ok(userSession()),readAIPreferences:()=>ok({fields:emptyFields(),version:'3',epoch:'3',confirmedAt:null}),bootstrapAI:()=>ok(aiSession(),201),activityAI:()=>ok({expiresAt:new Date(Date.now()+1_800_000).toISOString()}),readAI:()=>ok({sessionId:SID,generation:1,expiresAt:new Date(Date.now()+1_800_000).toISOString()}),resetAI:()=>noContent(),requestAI:call=>ok(status((call.body as {requestId:string}).requestId),202)});}
function Editor({apply,initial='',kind='APPLICATION'}:{apply:(draft:AIDraft)=>void;initial?:string;kind?:AIDraft['kind']}){
 const [text,setText]=useState(initial),[version,setVersion]=useState('0');
 useAssistantEditor({kind,targetId:kind==='CREATE'?null:MEAL_ID,text,version,apply:d=>{setText(d.text??`${d.fields?.title}\n${d.fields?.description}`);setVersion(v=>String(Number(v)+1));apply(d);}});
 return <label>Original editor<textarea className="resize-none" aria-label="Original editor" value={text} onChange={e=>{setText(e.target.value);setVersion(v=>String(Number(v)+1));}}/></label>;
}
function renderAssistant(stub:ReturnType<typeof baseStub>,editor?:React.ReactElement,pollers?:ReturnType<typeof fakePollerDeps>){
 const ui=<AssistantProvider>{editor}<AssistantLauncher/><AssistantPanel/></AssistantProvider>;
 return renderWithProviders(pollers?<PollerDepsContext.Provider value={()=>pollers.deps}>{ui}</PollerDepsContext.Provider>:ui,stub.fetch,'/discover');
}
async function open(){await userEvent.click(screen.getByRole('button',{name:'Ask Fancy'}));await screen.findByRole('dialog',{name:'A little help from Fancy'});}
async function send(text='Find a relaxed meal this Friday.'){await userEvent.type(screen.getByRole('textbox',{name:'Ask Fancy'}),text);await userEvent.click(screen.getByRole('button',{name:'Send to Fancy'}));}

describe('Ask Fancy production UI with isolated mock transport',()=>{
 it('clears only the assistant unsent text on New conversation and preserves the business editor',async()=>{
  const stub=baseStub(),apply=vi.fn();renderAssistant(stub,<Editor apply={apply} initial="Keep the business draft."/>);await open();await send();await screen.findByText('Here is a suggestion for you to review.');
  await userEvent.type(screen.getByRole('textbox',{name:'Ask Fancy'}),'Discard this assistant draft.');
  await userEvent.click(screen.getByRole('button',{name:'New conversation'}));await screen.findByText('A new conversation. Your saved preferences are kept.');
  expect((screen.getByRole('textbox',{name:'Ask Fancy'}) as HTMLTextAreaElement).value).toBe('');
  await userEvent.click(screen.getByRole('button',{name:'Close assistant'}));
  expect((screen.getByRole('textbox',{name:'Original editor'}) as HTMLTextAreaElement).value).toBe('Keep the business draft.');expect(apply).not.toHaveBeenCalled();
  expect(stub.callsTo('resetAI')[0]!.body).toMatchObject({reason:'NEW'});
 });
 it('keeps the approved assistant home and sends a real typed request only after an explicit user action',async()=>{
  const stub=baseStub();renderAssistant(stub);await open();expect(screen.getByText('What sounds good?')).toBeTruthy();expect(stub.callsTo('bootstrapAI')).toHaveLength(0);
  await send();await screen.findByText('Here is a suggestion for you to review.');
  expect(stub.callsTo('requestAI')).toHaveLength(1);const call=stub.callsTo('requestAI')[0]!;expect(call.body).toMatchObject({preferenceVersion:'3',sourcePage:'DISCOVER'});expect(call.body).not.toHaveProperty('editorText');expect(call.headers['ai-device-token']).toBe('d'.repeat(43));
  expect(stub.callsTo('bootstrapAI')[0]!.headers['idempotency-key']).toMatch(/^[a-f0-9-]{36}$/);expect(stub.calls.some(c=>['applyMeal','createMeal','sendMessage'].includes(c.operationId))).toBe(false);
 });
 it('stops polling while closed and shows a completed closed-period request only after Continue',async()=>{
  const stub=baseStub(),timers=fakePollerDeps();let done=false;
  stub.on('requestAI',call=>ok(status((call.body as {requestId:string}).requestId,false),202));stub.on('pollAI',call=>ok(status(call.params.requestId!,done)));
  renderAssistant(stub,undefined,timers);await open();await send();await waitFor(()=>expect(stub.callsTo('pollAI').length).toBeGreaterThan(0));
  await userEvent.click(screen.getByRole('button',{name:'Close assistant'}));const count=stub.callsTo('pollAI').length,activities=stub.callsTo('activityAI').length;done=true;
  await act(async()=>{await timers.advance(20_000);});expect(stub.callsTo('pollAI')).toHaveLength(count);expect(stub.callsTo('activityAI')).toHaveLength(activities);
  await open();expect(screen.queryByText('Here is a suggestion for you to review.')).toBeNull();await userEvent.click(screen.getByRole('button',{name:/Continue conversation/}));await screen.findByText('Here is a suggestion for you to review.');
 });
 it('requires explicit editor-text consent and a replacement confirmation, and only changes the original editor',async()=>{
  const stub=baseStub(),applied=vi.fn();stub.on('requestAI',call=>ok(status((call.body as {requestId:string}).requestId,true,result({draft:draft()})),202));stub.on('validateAIDraft',()=>ok(draft()));
  renderAssistant(stub,<Editor apply={applied} initial="My existing private introduction."/>);await open();await userEvent.click(screen.getByRole('checkbox',{name:'Include my current editor text for this request'}));await send('Please polish this introduction.');await screen.findByRole('button',{name:'Use in application'});
  expect(stub.callsTo('requestAI')[0]!.body).toMatchObject({editorText:'My existing private introduction.',explicitMealId:MEAL_ID});
  await userEvent.click(screen.getByRole('button',{name:'Use in application'}));await screen.findByRole('dialog',{name:'Replace your editor text?'});await userEvent.click(screen.getByRole('button',{name:'Keep my text'}));expect(stub.callsTo('validateAIDraft')).toHaveLength(0);expect(applied).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button',{name:'Use in application'}));await userEvent.click(screen.getByRole('button',{name:'Replace with this draft'}));await waitFor(()=>expect(applied).toHaveBeenCalledTimes(1));expect(stub.callsTo('validateAIDraft')[0]!.body).toMatchObject({editorKind:'APPLICATION',targetId:MEAL_ID,editorVersion:'0',replaceConfirmed:true});expect(stub.calls.some(c=>['applyMeal','createMeal','sendMessage'].includes(c.operationId))).toBe(false);
 });
 it('leaves a stale or unauthorized draft in the original editor unchanged',async()=>{
  const stub=baseStub(),applied=vi.fn();stub.on('requestAI',call=>ok(status((call.body as {requestId:string}).requestId,true,result({draft:draft()})),202));stub.on('validateAIDraft',()=>fail(409,'TARGET_CHANGED'));
  renderAssistant(stub,<Editor apply={applied}/>);await open();await send('Draft an introduction.');await screen.findByRole('button',{name:'Use in application'});await userEvent.click(screen.getByRole('button',{name:'Use in application'}));await screen.findByText('This meal or conversation changed. Check the original page before continuing.');expect(applied).not.toHaveBeenCalled();
 });
 it('keeps preference read/write/delete usable independently of model availability',async()=>{
  const stub=baseStub();stub.on('bootstrapAI',()=>fail(503,'AI_UNAVAILABLE'));stub.on('replaceAIPreferences',call=>ok({fields:(call.body as {fields:unknown}).fields,version:'4',epoch:'4',confirmedAt:new Date().toISOString()}));stub.on('deleteAIPreferences',()=>ok({fields:emptyFields(),version:'5',epoch:'5',confirmedAt:null}));
  renderAssistant(stub);await open();await send();await screen.findByText('Fancy is temporarily unavailable. Your meal plans and editors are still available.');await userEvent.click(screen.getByRole('button',{name:'My preferences'}));await screen.findByText('What I remember');
  const budget=screen.getByRole('textbox',{name:'Budget up to (£ per person)'});await userEvent.type(budget,'35');await userEvent.click(screen.getByRole('button',{name:'Confirm and save preferences'}));await waitFor(()=>expect(stub.callsTo('replaceAIPreferences')).toHaveLength(1));expect(stub.callsTo('replaceAIPreferences')[0]!.body).toMatchObject({fields:{budgetMaxPence:3500},confirmation:true});expect(stub.callsTo('replaceAIPreferences')[0]!.headers['if-match']).toBe('"3"');
  await userEvent.click(screen.getByRole('button',{name:'Delete preferences'}));await screen.findByRole('dialog',{name:'Delete your preferences?'});await userEvent.click(screen.getByRole('button',{name:'Delete preferences'}));await waitFor(()=>expect(stub.callsTo('deleteAIPreferences')).toHaveLength(1));expect(stub.callsTo('requestAI')).toHaveLength(0);
 });
 it('uses guest preferences as soft input without changing applied hard filters or saving account data',async()=>{
  const stub=baseStub();stub.on('getSession',()=>fail(401,'AUTH_REQUIRED'));stub.on('createGuestSession',()=>ok({guestToken:null,csrfToken:'guest-csrf',expiresAt:new Date(Date.now()+86_400_000).toISOString()},201));
  renderAssistant(stub);await open();await userEvent.click(screen.getByRole('button',{name:'My preferences'}));await userEvent.type(screen.getByRole('textbox',{name:'Budget up to (£ per person)'}),'35');await userEvent.click(screen.getByRole('button',{name:'Confirm and save preferences'}));await userEvent.click(screen.getByRole('button',{name:'Assistant home'}));await send();await screen.findByText('Here is a suggestion for you to review.');
  const call=stub.callsTo('requestAI')[0]!;expect(call.body).toMatchObject({preferenceVersion:'0',guestPreferences:{budgetMaxPence:3500}});expect((call.body as {appliedFilters:unknown}).appliedFilters).not.toHaveProperty('budgetMaxPence');expect(stub.callsTo('replaceAIPreferences')).toHaveLength(0);expect(call.headers['x-csrf-token']).toBe('guest-csrf');
 });
 it('does not append a late old-generation response after New conversation',async()=>{
  const stub=baseStub(),late=deferred<StubResponse>();stub.on('requestAI',()=>late.promise);renderAssistant(stub);await open();await send();await waitFor(()=>expect(stub.callsTo('requestAI')).toHaveLength(1));
  await userEvent.click(screen.getByRole('button',{name:'New conversation'}));await screen.findByText('A new conversation. Your saved preferences are kept.');
  const requestId=(stub.callsTo('requestAI')[0]!.body as {requestId:string}).requestId;await act(async()=>{late.resolve(ok(status(requestId),202));});expect(screen.queryByText('Here is a suggestion for you to review.')).toBeNull();expect(screen.queryByRole('button',{name:/Continue conversation/})).toBeNull();
 });
});

describe('Ask Fancy expiry, retries and typed draft boundaries',()=>{
 it('expires local conversation content at the boundary and preserves unsent user input',async()=>{
  const now=Date.now();const clock=vi.spyOn(Date,'now').mockReturnValue(now);const stub=baseStub();renderAssistant(stub);await open();await send();await screen.findByText('Here is a suggestion for you to review.');
  clock.mockReturnValue(now+1_800_001);await userEvent.type(screen.getByRole('textbox',{name:'Ask Fancy'}),'Keep my unsent wording.');await userEvent.click(screen.getByRole('button',{name:'Send to Fancy'}));await screen.findByText('This conversation has expired. Your unsent message is kept; start a new conversation.');expect(screen.queryByText('Here is a suggestion for you to review.')).toBeNull();expect((screen.getByRole('textbox',{name:'Ask Fancy'}) as HTMLTextAreaElement).value).toBe('Keep my unsent wording.');
 });
 it('reuses the same request id for an explicit retry after an unknown transport outcome and never retries the model automatically',async()=>{
  const stub=baseStub();let n=0;stub.on('requestAI',call=>++n===1?fail(503,'AI_UNAVAILABLE'):ok(status((call.body as {requestId:string}).requestId),202));renderAssistant(stub);await open();await send();await screen.findByText('Fancy is temporarily unavailable. Your meal plans and editors are still available.');expect(stub.callsTo('requestAI')).toHaveLength(1);await userEvent.click(screen.getByRole('button',{name:'Send to Fancy'}));await screen.findByText('Here is a suggestion for you to review.');const calls=stub.callsTo('requestAI');expect((calls[0]!.body as {requestId:string}).requestId).toBe((calls[1]!.body as {requestId:string}).requestId);
 });
 it('preserves a newly edited unsent question while an earlier send is waiting for acknowledgement',async()=>{
  const stub=baseStub(),late=deferred<StubResponse>();stub.on('requestAI',()=>late.promise);renderAssistant(stub);await open();await send('Earlier question.');await waitFor(()=>expect(stub.callsTo('requestAI')).toHaveLength(1));
  await userEvent.clear(screen.getByRole('textbox',{name:'Ask Fancy'}));await userEvent.type(screen.getByRole('textbox',{name:'Ask Fancy'}),'My next unsent question.');const id=(stub.callsTo('requestAI')[0]!.body as {requestId:string}).requestId;await act(async()=>late.resolve(ok(status(id),202)));expect((screen.getByRole('textbox',{name:'Ask Fancy'}) as HTMLTextAreaElement).value).toBe('My next unsent question.');
 });
 it.each(['CREATE','GROUP'] as const)('transfers a %s candidate only through its matching original editor',async(kind)=>{
  const stub=baseStub(),applied=vi.fn();const candidate:AIDraft={...draft(),kind,targetId:kind==='CREATE'?null:MEAL_ID,text:kind==='CREATE'?null:'Looking forward to meeting everyone at the table.',fields:kind==='CREATE'?{title:'A friendly table in London',description:'Join a relaxed meal to share stories and meet new people.'}:null};stub.on('requestAI',call=>ok(status((call.body as {requestId:string}).requestId,true,result({draft:candidate})),202));stub.on('validateAIDraft',()=>ok(candidate));renderAssistant(stub,<Editor kind={kind} apply={applied}/>);await open();await send('Prepare a candidate.');await userEvent.click(await screen.findByRole('button',{name:kind==='CREATE'?'Use in meal form':'Use in group editor'}));await waitFor(()=>expect(applied).toHaveBeenCalledTimes(1));expect(stub.callsTo('validateAIDraft')[0]!.body).toMatchObject({editorKind:kind,targetId:candidate.targetId,replaceConfirmed:false});expect(stub.calls.some(c=>['createMeal','sendMessage','applyMeal'].includes(c.operationId))).toBe(false);
 });
 it('sends selected meal ids explicitly for comparison without submitting a meal action',async()=>{
  const stub=baseStub();const cards=[{mealId:MEAL_ID,title:'First meal',startsAt:'2026-10-25T18:00:00Z',budgetMaxPence:3000,capacity:4,version:'1'},{mealId:'99999999-9999-4999-8999-999999999999',title:'Second meal',startsAt:'2026-10-25T19:00:00Z',budgetMaxPence:4000,capacity:3,version:'1'}];stub.on('requestAI',call=>ok(status((call.body as {requestId:string}).requestId,true,result({cards})),202));renderAssistant(stub);await open();await send();await userEvent.click(await screen.findByRole('button',{name:'Compare these meals'}));await waitFor(()=>expect(stub.callsTo('requestAI')).toHaveLength(2));expect(stub.callsTo('requestAI')[1]!.body).toMatchObject({explicitMealIds:cards.map(card=>card.mealId)});
 });
});

describe('assistant keyboard ownership',()=>{
 it('returns focus to the launcher after Escape closes the controlled sheet',async()=>{
  const stub=baseStub();renderAssistant(stub);await open();await userEvent.click(screen.getByRole('textbox',{name:'Ask Fancy'}));await userEvent.keyboard('{Escape}');await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'Ask Fancy'})));
 });
});
