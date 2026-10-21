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
