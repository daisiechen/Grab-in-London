/** Exercise the real console cache across a revoked snapshot, including a previously cached other snapshot. */
import {useState} from 'react';
import {expect,it} from 'vitest';
import {render,screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {ApiError} from '@fancy/client';
import {createAdminApi,type AdminApi} from '../api/admin-api.ts';
import {mockFetch,ok,list,pageData,session,snapshot,SNAP_A,SNAP_B} from '../test/mock-api.ts';
import {ConsoleProvider,useConsole} from './console.tsx';
import {parseSearch} from './filters.ts';
const filters=parseSearch('').filters;
function Probe(){const c=useConsole();return <><pre data-testid="metrics">{c.pageState.status==='ready'?JSON.stringify(c.pageState.data.metrics):c.pageState.status}</pre><p data-testid="picker">{String(c.pickerOpen)}</p><button onClick={()=>c.selectSnapshot(SNAP_A)}>select A</button><button onClick={()=>c.selectSnapshot(SNAP_B)}>select B</button><button onClick={()=>c.reportFailure(new ApiError({status:410,code:'SNAPSHOT_REVOKED',message:'Synthetic revoked snapshot'}))}>receive410</button></>;}
function Harness({api}:{api:AdminApi}){const[id,setId]=useState<string|null>(SNAP_A);return <ConsoleProvider api={api} page="overview" filters={filters} snapshotId={id} onSnapshotChange={setId}><Probe/></ConsoleProvider>;}
it('QA-PRIVACY-005 410 clears current and other cached snapshot data and requires a fresh server read',async()=>{
 const a=snapshot(SNAP_A,'2026-10-18T12:00:00Z'),b=snapshot(SNAP_B,'2026-10-19T12:00:00Z');let aReads=0;
 const mock=mockFetch({'GET /v1/auth/session':()=>ok(session()),'GET /v1/admin/snapshots':()=>list([b,a]),'GET /v1/admin/overview':c=>{const isA=c.query.get('snapshotId')===SNAP_A;return ok(pageData('overview',isA?a:b,{sentinel:isA?(++aReads===1?111:333):222}));}});
 render(<Harness api={createAdminApi({fetch:mock.fetch})}/>);
 await waitFor(()=>expect(screen.getByTestId('metrics').textContent).toContain('111'));
 await userEvent.click(screen.getByText('select B'));await waitFor(()=>expect(screen.getByTestId('metrics').textContent).toContain('222'));
 await userEvent.click(screen.getByText('receive410'));await waitFor(()=>expect(screen.getByTestId('picker').textContent).toBe('true'));
 expect(screen.getByTestId('metrics').textContent).not.toMatch(/111|222/);
 await userEvent.click(screen.getByText('select A'));await waitFor(()=>expect(screen.getByTestId('metrics').textContent).toContain('333'));expect(aReads).toBe(2);
});
