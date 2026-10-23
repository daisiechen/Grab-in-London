import {useState} from 'react';
import {fireEvent,screen,waitFor} from '@testing-library/react-native';
import DeletionStatusRoute from '../../../../app/deletion-status.tsx';
import {MyProfileScreen} from './MyProfileScreen.tsx';
import {createTestApp,renderApp} from '../../../test/render.tsx';
import {mockRouter,resetRouter} from '../../../test/router.ts';
import {memoryDeletionReceiptStore} from '../../settings/deletion-receipt-store.ts';
import {ok} from '../../../test/mock-fetch.ts';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- shared router boundary double
jest.mock('expo-router',()=>require('../../../test/router.ts').expoRouterMock);

function GuestRouteJourney(){const[route,setRoute]=useState('/profile');mockRouter.push.mockImplementation((next:string)=>setRoute(next));return route==='/deletion-status'?<DeletionStatusRoute/>:<MyProfileScreen/>;}
beforeEach(()=>{resetRouter();mockRouter.push.mockReset();});
afterEach(()=>{mockRouter.push.mockReset();});

it('guest profile reaches the actual anonymous route with saved receipt, querying only on explicit press',async()=>{
 const receiptToken='R'.repeat(43),saved=memoryDeletionReceiptStore();await saved.write({ownerId:'00000000-0000-4000-8000-000000000001',key:'00000000-0000-4000-8000-000000000002',receiptToken});const app=createTestApp({deletionReceiptStore:saved});await app.services.session.restore();
 await renderApp(app,<GuestRouteJourney/>);expect(screen.getByTestId('profile-guest')).toBeVisible();expect(screen.queryByDisplayValue(receiptToken)).toBeNull();expect(app.mock.callsTo('POST','/v1/deletion-status')).toHaveLength(0);
 await fireEvent.press(screen.getByRole('button',{name:'Check deletion status'}));expect(mockRouter.push).toHaveBeenCalledWith('/deletion-status');await waitFor(()=>expect(screen.getByLabelText('Deletion reference')).toHaveDisplayValue(receiptToken));expect(app.mock.callsTo('POST','/v1/deletion-status')).toHaveLength(0);expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(0);
 app.mock.on('POST','/v1/deletion-status',ok({status:'PENDING',requestedAt:'2026-10-22T12:00:00.000Z',completedAt:null}));await fireEvent.press(screen.getByRole('button',{name:'Check status'}));await waitFor(()=>expect(screen.getByText('Status: Requested')).toBeVisible());expect(app.mock.callsTo('POST','/v1/deletion-status')).toHaveLength(1);const lookup=app.mock.callsTo('POST','/v1/deletion-status')[0]!;expect(lookup.headers.authorization).toBeUndefined();expect(lookup.headers.cookie).toBeUndefined();expect(lookup.body).toEqual({receiptToken});expect(app.mock.callsTo('POST','/v1/auth/refresh')).toHaveLength(0);expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(0);expect(app.services.session.getState().status).toBe('signedOut');
});
it('guest without a saved receipt can open status without signing in or issuing a deletion request',async()=>{
 const app=createTestApp();await app.services.session.restore();await renderApp(app,<GuestRouteJourney/>);expect(screen.getByRole('button',{name:'Sign in or create an account'})).toBeVisible();await fireEvent.press(screen.getByRole('button',{name:'Check deletion status'}));expect(screen.getByTestId('deletion-status')).toBeVisible();expect(screen.getByLabelText('Deletion reference')).toHaveDisplayValue('');expect(app.mock.callsTo('POST','/v1/deletion-status')).toHaveLength(0);expect(app.mock.callsTo('POST','/v1/me/deletion')).toHaveLength(0);
});
