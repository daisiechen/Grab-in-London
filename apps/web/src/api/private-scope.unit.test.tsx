/** Independent probes: query cache clearing alone cannot clear component-owned private forms. */
import {useState} from 'react';
import {describe,expect,it} from 'vitest';
import {screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {useSession} from './session.tsx';
import {useApi} from './ApiProvider.tsx';
import {renderWithProviders} from '../test/render.tsx';
import {createFetchStub,fail,ok} from '../test/fetchStub.ts';
import {HOST_ID,session} from '../test/fixtures.ts';
import {loadDraft,saveDraft} from '../lib/drafts.ts';

function LocalPrivatePage(){
 const {state,refresh,signOut,clearLocal}=useSession();const {api,cache}=useApi();
 const [privateText,setPrivateText]=useState('');const [selection,setSelection]=useState(false);
 return <div>
  <p data-testid="identity">{state.status==='signed-in'?state.session.user.displayName:state.status}</p>
  <input aria-label="Private message draft" value={privateText} onChange={event=>setPrivateText(event.target.value)}/>
  <input aria-label="Private reconnect choice" type="checkbox" checked={selection} onChange={event=>setSelection(event.target.checked)}/>
  <p data-testid="private-cache-size">{cache.size}</p>
  <button onClick={()=>{cache.set('private:review','Previous account private body');saveDraft('apply:private-scope',{intro:'Previous account private intro'});}}>store private data</button>
  <button onClick={()=>void refresh()}>refresh session</button>
  <button onClick={()=>void signOut()}>sign out</button>
  <button onClick={()=>void api.client.call('getMe',{}).catch(()=>{})}>fetch private profile</button>
  <button onClick={clearLocal}>deletion accepted</button>
 </div>;
}
async function fillPrivateState(){
 await userEvent.type(screen.getByRole('textbox',{name:'Private message draft'}),'Previous account secret sentinel');
 await userEvent.click(screen.getByRole('checkbox',{name:'Private reconnect choice'}));
 await userEvent.click(screen.getByText('store private data'));
}
function expectLocalPrivateStateEmpty(){
 expect((screen.getByRole('textbox',{name:'Private message draft'}) as HTMLInputElement).value).toBe('');
 expect((screen.getByRole('checkbox',{name:'Private reconnect choice'}) as HTMLInputElement).checked).toBe(false);
 expect(screen.getByTestId('private-cache-size').textContent).toBe('0');
 expect(loadDraft('apply:private-scope')).toBeNull();
}

describe('private component state ownership across Web session boundaries',()=>{
 it('destroys local message, selection, query cache and persisted draft when account identity changes',async()=>{
  let calls=0;const stub=createFetchStub({getSession:()=>ok(++calls===1?session():session({id:HOST_ID,displayName:'Second Account'}))});
  renderWithProviders(<LocalPrivatePage/>,stub.fetch);await waitFor(()=>expect(screen.getByTestId('identity').textContent).toBe('Sam Rivera'));await fillPrivateState();
  await userEvent.click(screen.getByText('refresh session'));await waitFor(()=>expect(screen.getByTestId('identity').textContent).toBe('Second Account'));expectLocalPrivateStateEmpty();
 });
 it('preserves the same account local draft during profile/session refreshes',async()=>{
  let calls=0;const stub=createFetchStub({getSession:()=>ok(session({displayName:++calls===1?'Sam Rivera':'Updated Name'}))});
  renderWithProviders(<LocalPrivatePage/>,stub.fetch);await waitFor(()=>expect(screen.getByTestId('identity').textContent).toBe('Sam Rivera'));await fillPrivateState();
  await userEvent.click(screen.getByText('refresh session'));await waitFor(()=>expect(screen.getByTestId('identity').textContent).toBe('Updated Name'));
  expect((screen.getByRole('textbox',{name:'Private message draft'}) as HTMLInputElement).value).toContain('Previous account secret sentinel');expect((screen.getByRole('checkbox',{name:'Private reconnect choice'}) as HTMLInputElement).checked).toBe(true);expect(loadDraft('apply:private-scope')).not.toBeNull();
 });
 it('destroys local component state after a server 401',async()=>{
  const stub=createFetchStub({getSession:()=>ok(session()),getMe:()=>fail(401,'AUTH_REQUIRED')});
  renderWithProviders(<LocalPrivatePage/>,stub.fetch);await waitFor(()=>expect(screen.getByTestId('identity').textContent).toBe('Sam Rivera'));await fillPrivateState();
  await userEvent.click(screen.getByText('fetch private profile'));await waitFor(()=>expect(screen.getByTestId('identity').textContent).toBe('guest'));expectLocalPrivateStateEmpty();
 });
 it('destroys local component state after logout even if the server is unavailable',async()=>{
  const stub=createFetchStub({getSession:()=>ok(session()),logout:()=>fail(503,'PROVIDER_UNAVAILABLE')});
  renderWithProviders(<LocalPrivatePage/>,stub.fetch);await waitFor(()=>expect(screen.getByTestId('identity').textContent).toBe('Sam Rivera'));await fillPrivateState();
  await userEvent.click(screen.getByText('sign out'));await waitFor(()=>expect(screen.getByTestId('identity').textContent).toBe('guest'));expectLocalPrivateStateEmpty();
 });
 it('destroys local component state on deletion acceptance even before navigating away',async()=>{
  const stub=createFetchStub({getSession:()=>ok(session())});renderWithProviders(<LocalPrivatePage/>,stub.fetch);await waitFor(()=>expect(screen.getByTestId('identity').textContent).toBe('Sam Rivera'));await fillPrivateState();
  await userEvent.click(screen.getByText('deletion accepted'));await waitFor(()=>expect(screen.getByTestId('identity').textContent).toBe('guest'));expectLocalPrivateStateEmpty();
 });
});
