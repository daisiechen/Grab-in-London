/** QA-AI-045: PRD513 requires retaining overlong original input and an inline shorten message. */
import {expect,it} from 'vitest';
import {fireEvent,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {renderWithProviders} from '../../test/render.tsx';
import {createFetchStub,ok} from '../../test/fetchStub.ts';
import {session} from '../../test/fixtures.ts';
import {AssistantProvider} from './context.tsx';
import {AssistantLauncher} from './AssistantLauncher.tsx';
import {AssistantPanel} from './AssistantPanel.tsx';
import {emptyFields} from './model.ts';
function setup(){const stub=createFetchStub({getSession:()=>ok(session()),readAIPreferences:()=>ok({fields:emptyFields(),version:'0',epoch:'0',confirmedAt:null})});renderWithProviders(<AssistantProvider><AssistantLauncher/><AssistantPanel/></AssistantProvider>,stub.fetch,'/discover');return stub;}
async function open(){await userEvent.click(screen.getByRole('button',{name:'Ask Fancy'}));return screen.findByRole('textbox',{name:'Ask Fancy'});}
it('QA-F10 pasted 2001-character original is preserved instead of silently truncated',async()=>{
 const stub=setup(),field=await open(),original='x'.repeat(2000)+'Z';
 await userEvent.click(field);await userEvent.paste(original);
 expect((field as HTMLTextAreaElement).value).toBe(original);
 await userEvent.click(screen.getByRole('button',{name:'Send to Fancy'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toMatch(/2000|2,000|shorten|long/i));
 expect(stub.callsTo('requestAI')).toHaveLength(0);
});
it('QA-F10 an overlong controlled editor value gets a visible inline error without losing text or requesting AI',async()=>{
 const stub=setup(),field=await open(),original='y'.repeat(2001);
 fireEvent.change(field,{target:{value:original}});
 await userEvent.click(screen.getByRole('button',{name:'Send to Fancy'}));
 await waitFor(()=>expect(screen.getByRole('alert').textContent).toMatch(/2000|2,000|shorten|long/i));
 expect((field as HTMLTextAreaElement).value).toBe(original);expect(stub.callsTo('requestAI')).toHaveLength(0);
});
it('QA-F10 blank sends nothing, raw edge whitespace cannot bypass2000 and shortening to2000 resumes one explicit request',async()=>{
 const stub=setup(),sid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 stub.on('bootstrapAI',()=>ok({sessionId:sid,generation:1,deviceToken:'d'.repeat(43),revokeHandle:'r'.repeat(43),expiresAt:new Date(Date.now()+1800000).toISOString()},201));
 stub.on('activityAI',()=>ok({expiresAt:new Date(Date.now()+1800000).toISOString()}));
 stub.on('requestAI',call=>ok({requestId:(call.body as {requestId:string}).requestId,sessionId:sid,generation:1,state:'PENDING',deadline:new Date(Date.now()+30000).toISOString(),result:null,errorCode:null},202));
 stub.on('pollAI',call=>ok({requestId:call.params.requestId,sessionId:sid,generation:1,state:'SUCCEEDED',deadline:new Date(Date.now()+30000).toISOString(),result:{replyText:'Synthetic normal recovery response',cards:[]},errorCode:null}));
 const field=await open();fireEvent.change(field,{target:{value:'   '}});await userEvent.click(screen.getByRole('button',{name:'Send to Fancy'}));expect(stub.callsTo('requestAI')).toHaveLength(0);
 const overlong=' '+ 'q'.repeat(1999)+' ';fireEvent.change(field,{target:{value:overlong}});await userEvent.click(screen.getByRole('button',{name:'Send to Fancy'}));
 expect((field as HTMLTextAreaElement).value).toBe(overlong);expect(screen.getByRole('alert').textContent).toMatch(/2000|2,000|shorten|long/i);expect(stub.callsTo('requestAI')).toHaveLength(0);
 const allowed='q'.repeat(2000);fireEvent.change(field,{target:{value:allowed}});await userEvent.click(screen.getByRole('button',{name:'Send to Fancy'}));
 await waitFor(()=>expect(stub.callsTo('requestAI')).toHaveLength(1));expect((stub.callsTo('requestAI')[0]!.body as {input:string}).input).toBe(allowed);
});
