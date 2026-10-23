/** Codex acceptance: the newly returned receipt's delay controls the next poll. */
import {createElement as h,useState} from 'react';
import {act,fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {createAdminApi,type AdminApi} from '../../apps/admin/src/api/admin-api.ts';
import {mockFetch,ok,list,pageData,session,snapshot,SNAP_A} from '../../apps/admin/src/test/mock-api.ts';
import {ConsoleProvider,useConsole} from '../../apps/admin/src/state/console.tsx';
import {parseSearch} from '../../apps/admin/src/state/filters.ts';
const key='00000000-0000-4000-8000-0000000000c1',target='20000000-0000-4000-8000-000000000001';
function Probe(){const c=useConsole();return h('button',{disabled:!c.session,onClick:()=>{const intent={accountId:c.session!.user.id,key,targetUserId:target,classification:'test' as const,reason:'Synthetic delay test',baseRevision:'0'};c.dispatchIntent({type:'submit',intent});c.dispatchIntent({type:'saveFailed',scope:{accountId:intent.accountId,key,targetUserId:target},kind:'network',code:null,currentVersion:null});}},'start');}
function Harness({api}:{api:AdminApi}){const[id,setId]=useState<string|null>(SNAP_A);return h(ConsoleProvider,{api,page:'overview',filters:parseSearch('').filters,snapshotId:id,onSnapshotChange:setId,syncIntervalMs:10,children:h(Probe)});}
it('honors the first PENDING receipt Retry-After before another original-intent read',async()=>{
 vi.useFakeTimers();
 const snap=snapshot(SNAP_A,'2026-10-18T12:00:00Z');const mock=mockFetch({'GET /v1/auth/session':()=>ok(session()),'GET /v1/admin/snapshots':()=>list([snap]),'GET /v1/admin/overview':()=>ok(pageData('overview',snap,{}))});
 const api=createAdminApi({fetch:mock.fetch});api.classifyReceipt=vi.fn<AdminApi['classifyReceipt']>(async()=>({operation:'classifyUser',key,state:'PENDING',retryable:false,expired:false,retryAfterSeconds:120,httpStatus:null,errorCode:null,conflict:null,resourceId:null,resourceVersion:null,currentVersion:null,completedAt:null,expiresAt:null}));
 const view=render(h(Harness,{api}));
 try{
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  expect(screen.getByRole('button',{name:'start'}).hasAttribute('disabled')).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'start'}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(20);});
  expect(api.classifyReceipt).toHaveBeenCalledTimes(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
  expect(api.classifyReceipt).toHaveBeenCalledTimes(1);
 }finally{view.unmount();vi.useRealTimers();}
});
