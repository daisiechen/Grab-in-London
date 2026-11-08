import {useState} from 'react';
import {useSession} from '../../api/session.tsx';
import {expect,it} from 'vitest';
import {act,fireEvent,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {MemberSafety} from './MemberSafety.tsx';
import {renderWithProviders} from '../../test/render.tsx';
import {createFetchStub,ok,fail,deferred,type StubResponse} from '../../test/fetchStub.ts';
import {HOST_ID,session} from '../../test/fixtures.ts';
it('loads a persisted block revision after refresh and unblocks using that revision once',async()=>{
 const held=deferred<StubResponse>();const stub=createFetchStub({getSession:()=>ok(session()),getBlock:()=>ok({subjectId:HOST_ID,blocked:true,version:'7'}),unblock:()=>held.promise});
 renderWithProviders(<MemberSafety subjectId={HOST_ID} name="Maya"/>,stub.fetch);
 await userEvent.click(await screen.findByRole('button',{name:'Unblock Maya'}));await userEvent.dblClick(await screen.findByRole('button',{name:'Confirm unblock'}));expect(stub.callsTo('unblock')).toHaveLength(1);expect(stub.callsTo('unblock')[0]!.headers['if-match']).toBe('"7"');
 held.resolve(ok({subjectId:HOST_ID,blocked:false,version:'8'}));await waitFor(()=>expect(screen.queryByRole('button',{name:'Unblock Maya'})).toBeNull());
});
it('reloads a conflict from the server instead of inferring the opposite block state',async()=>{
 let reads=0;const stub=createFetchStub({getSession:()=>ok(session()),getBlock:()=>ok({subjectId:HOST_ID,blocked:true,version:++reads===1?'2':'9'}),unblock:()=>fail(409,'VERSION_CONFLICT',{currentVersion:'3'})});
 renderWithProviders(<MemberSafety subjectId={HOST_ID} name="Maya"/>,stub.fetch);
 await userEvent.click(await screen.findByRole('button',{name:'Unblock Maya'}));await userEvent.click(await screen.findByRole('button',{name:'Confirm unblock'}));await waitFor(()=>expect(stub.callsTo('getBlock')).toHaveLength(2));expect(await screen.findByRole('button',{name:'Unblock Maya'})).toBeTruthy();
});
it('keeps writes disabled until a failed read is explicitly retried successfully',async()=>{
 let reads=0;const stub=createFetchStub({getSession:()=>ok(session()),getBlock:()=>++reads===1?fail(503,'PROVIDER_UNAVAILABLE'):ok({subjectId:HOST_ID,blocked:false,version:'4'})});
 renderWithProviders(<MemberSafety subjectId={HOST_ID} name="Maya"/>,stub.fetch);
 await screen.findByRole('button',{name:'Reload safety settings'});expect(screen.queryByRole('button',{name:'Block Maya'})).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'Reload safety settings'}));await waitFor(()=>expect((screen.getByRole('button',{name:'Block Maya'}) as HTMLButtonElement).disabled).toBe(false));expect(stub.callsTo('block')).toHaveLength(0);
});

it('ignores an earlier subject read after switching to another member',async()=>{
 const held=deferred<StubResponse>();const other='77777777-7777-4777-8777-777777777777';
 const stub=createFetchStub({getSession:()=>ok(session()),getBlock:call=>call.params.subjectId===HOST_ID?held.promise:ok({subjectId:other,blocked:false,version:'5'})});
 function Switch(){const [subject,setSubject]=useState(HOST_ID);return <><button onClick={()=>setSubject(other)}>Other member</button><MemberSafety subjectId={subject} name="Member"/></>;}
 renderWithProviders(<Switch/>,stub.fetch);await waitFor(()=>expect(stub.callsTo('getBlock')).toHaveLength(1));await userEvent.click(screen.getByRole('button',{name:'Other member'}));await waitFor(()=>expect(stub.callsTo('getBlock')).toHaveLength(2));
 await act(async()=>held.resolve(ok({subjectId:HOST_ID,blocked:true,version:'99'})));
 expect(screen.queryByRole('button',{name:'Unblock Member'})).toBeNull();expect((screen.getByRole('button',{name:'Block Member'}) as HTMLButtonElement).disabled).toBe(false);
});
it('drops a late write after the authenticated actor changes without showing its success toast',async()=>{
 let actor=0;const held=deferred<StubResponse>();const stub=createFetchStub({getSession:()=>ok(session(actor?{id:'77777777-7777-4777-8777-777777777777'}:{})),getBlock:()=>ok({subjectId:HOST_ID,blocked:!actor,version:actor?'8':'2'}),unblock:()=>held.promise});
 function Switch(){const {refresh}=useSession();return <><button onClick={()=>{actor=1;void refresh();}}>Other account</button><MemberSafety subjectId={HOST_ID} name="Member"/></>;}
 renderWithProviders(<Switch/>,stub.fetch);await userEvent.click(await screen.findByRole('button',{name:'Unblock Member'}));await userEvent.click(await screen.findByRole('button',{name:'Confirm unblock'}));fireEvent.click(screen.getByText('Other account'));await waitFor(()=>expect(stub.callsTo('getBlock')).toHaveLength(2));
 await act(async()=>held.resolve(ok({subjectId:HOST_ID,blocked:false,version:'3'})));
 expect(screen.queryByText('Member unblocked. Your previous connection is not restored.')).toBeNull();expect(screen.queryByRole('button',{name:'Unblock Member'})).toBeNull();
});
