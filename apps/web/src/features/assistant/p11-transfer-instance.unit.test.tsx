/** Mock transport UI evidence only; never a real-model or external-provider acceptance claim. */
import {useState} from 'react';
import {act,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {expect,it,vi} from 'vitest';
import {renderWithProviders} from '../../test/render.tsx';
import {createFetchStub,deferred,noContent,ok,type StubResponse} from '../../test/fetchStub.ts';
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

 it('does not transfer an old validation into a remounted editor with the same target and version',async()=>{
  const held=deferred<StubResponse>(),stub=baseStub(),applied=vi.fn();
  function Host(){const [revision,setRevision]=useState(0);return <><button onClick={()=>setRevision(v=>v+1)}>Reopen original form</button><Editor key={revision} apply={applied}/></>;}
  stub.on('requestAI',call=>ok(status((call.body as {requestId:string}).requestId,true,result({draft:draft()})),202));
  stub.on('validateAIDraft',()=>held.promise);
  renderAssistant(stub,<Host/>);await open();await send('Draft a friendly application.');
  await userEvent.click(await screen.findByRole('button',{name:'Use in application'}));
  await waitFor(()=>expect(stub.callsTo('validateAIDraft')).toHaveLength(1));
  await userEvent.click(screen.getByRole('button',{name:'Close assistant'}));
  await userEvent.click(screen.getByRole('button',{name:'Reopen original form'}));
  await act(async()=>{held.resolve(ok(draft()));});
  expect(applied).not.toHaveBeenCalled();
  expect((screen.getByLabelText('Original editor') as HTMLTextAreaElement).value).toBe('');
 });

