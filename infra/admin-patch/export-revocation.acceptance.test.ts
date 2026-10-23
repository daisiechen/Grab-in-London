/** Codex acceptance: revocation fences already in-flight export completions. */
import {createElement as h,useState} from 'react';
import {act,render,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {expect,it,vi} from 'vitest';
import {ApiError} from '../../packages/client/src/index.ts';
import {createAdminApi,type AdminApi} from '../../apps/admin/src/api/admin-api.ts';
import {ExportButton} from '../../apps/admin/src/features/exports/ExportButton.tsx';
import {mockFetch,ok,list,pageData,session,snapshot,SNAP_A} from '../../apps/admin/src/test/mock-api.ts';
import {ConsoleProvider,useConsole} from '../../apps/admin/src/state/console.tsx';
import {parseSearch} from '../../apps/admin/src/state/filters.ts';
const filters=parseSearch('').filters;
function Probe(){const c=useConsole();return h('div',null,h('button',{onClick:()=>c.reportFailure(new ApiError({status:410,code:'SNAPSHOT_REVOKED',message:'Synthetic revocation'}))},'revoke'),h('span',{'data-testid':'revoked'},String(c.revokedNotice)),!c.revokedNotice&&h(ExportButton,{scope:'summary.overview',binding:c.binding&&{...c.binding,filterHash:c.binding.filterHash??'synthetic'},t:(_zh,en)=>en}));}
function Harness({api}:{api:AdminApi}){const[id,setId]=useState<string|null>(SNAP_A);return h(ConsoleProvider,{api,page:'overview',filters,snapshotId:id,onSnapshotChange:setId,children:h(Probe)});}
it('does not save a late CSV after its snapshot was revoked and the export control unmounted',async()=>{
 let finish!:(value:string)=>void;const held=new Promise<string>(resolve=>{finish=resolve;});
 const snap=snapshot(SNAP_A,'2026-10-18T12:00:00Z');
 const mock=mockFetch({'GET /v1/auth/session':()=>ok(session()),'GET /v1/admin/snapshots':()=>list([snap]),'GET /v1/admin/overview':()=>ok(pageData('overview',snap,{}))});
 const api=createAdminApi({fetch:mock.fetch});api.createExport=async()=>({exportId:'55555555-5555-4555-8555-555555555555',snapshotId:SNAP_A,expiresAt:'2026-10-18T13:10:00Z'});
 api.downloadExport=vi.fn(()=>held);
 Object.assign(URL,{createObjectURL:vi.fn(()=>'blob:synthetic'),revokeObjectURL:vi.fn()});
 const save=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>undefined);
 render(h(Harness,{api}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Export metrics'}).hasAttribute('disabled')).toBe(false));
 await userEvent.click(screen.getByRole('button',{name:'Export metrics'}));
 await waitFor(()=>expect(api.downloadExport).toHaveBeenCalledTimes(1));
 await userEvent.click(screen.getByRole('button',{name:'revoke'}));
 expect(screen.getByTestId('revoked').textContent).toBe('true');
 expect(screen.queryByRole('button',{name:'Export metrics'})).toBeNull();
 await act(async()=>{finish('private,synthetic\r\n');await held;});
 expect(save).not.toHaveBeenCalled();
});
