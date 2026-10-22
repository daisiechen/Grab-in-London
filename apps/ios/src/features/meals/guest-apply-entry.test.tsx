import {fireEvent,screen} from '@testing-library/react-native';
import {MealDetailScreen} from './MealDetailScreen.tsx';
import {createTestApp,renderApp,signIn} from '../../test/render.tsx';
import {mockRouter,resetRouter,routeParams} from '../../test/router.ts';
import {ok} from '../../test/mock-fetch.ts';
import {MEAL_ID,meal,me} from '../../test/fixtures.ts';
import {clearReturnTo,peekReturnTo} from '../auth/intent.ts';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- navigation test boundary
jest.mock('expo-router',()=>require('../../test/router.ts').expoRouterMock);
beforeEach(()=>{resetRouter();clearReturnTo();routeParams.current={mealId:MEAL_ID};});
it('offers a guest login entry without APPLY and remembers the application without submitting',async()=>{
 const app=createTestApp();await app.services.session.restore();
 app.mock.on('GET',`/v1/meals/${MEAL_ID}`,ok({meal:meal({allowedActions:[]}),myApplication:null,conversationId:null}));
 await renderApp(app,<MealDetailScreen/>);
 await fireEvent.press(await screen.findByRole('button',{name:'Request to join'}));
 expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
 expect(peekReturnTo()).toBe(`/meals/${MEAL_ID}/apply`);
 expect(app.mock.callsTo('POST',/applications/)).toHaveLength(0);
});
it.each(['cancelled','closed','started','full'] as const)('does not offer a guest entry for %s meals',async kind=>{
 const base=meal({allowedActions:[]});
 const app=createTestApp({now:()=>Date.parse(kind==='closed'?base.closesAt.instant:kind==='started'?base.startsAt.instant:'2026-10-22T12:00:00Z')});
 await app.services.session.restore();
 const m=meal({allowedActions:[],...(kind==='cancelled'?{status:'CANCELLED' as const}:{}),...(kind==='full'?{confirmedCount:base.capacity}:{}),...(kind==='started'?{closesAt:{...base.closesAt,instant:'2026-10-26T18:00:00Z'}}:{})});
 app.mock.on('GET',`/v1/meals/${MEAL_ID}`,ok({meal:m,myApplication:null,conversationId:null}));
 await renderApp(app,<MealDetailScreen/>);await screen.findByText('Sunday dinner');
 expect(screen.queryByRole('button',{name:'Request to join'})).toBeNull();
});
it('does not grant the guest fallback to a signed-in user without APPLY',async()=>{
 const app=createTestApp();await signIn(app,me());
 app.mock.on('GET',`/v1/meals/${MEAL_ID}`,ok({meal:meal({allowedActions:[]}),myApplication:null,conversationId:null}));
 await renderApp(app,<MealDetailScreen/>);await screen.findByText('Sunday dinner');
 expect(screen.queryByRole('button',{name:'Request to join'})).toBeNull();
});
it('keeps the fallback hidden while auth is restoring',async()=>{
 const app=createTestApp();
 app.mock.on('GET',`/v1/meals/${MEAL_ID}`,ok({meal:meal({allowedActions:[]}),myApplication:null,conversationId:null}));
 await renderApp(app,<MealDetailScreen/>);await screen.findByText('Sunday dinner');
 expect(app.services.session.getState().status).toBe('restoring');
 expect(screen.queryByRole('button',{name:'Request to join'})).toBeNull();
});
it('keeps the fallback hidden when credential restoration is unavailable',async()=>{
 const app=createTestApp();jest.spyOn(app.store,'readRefresh').mockRejectedValue(new Error('synthetic unavailable'));
 await app.services.session.restore();
 app.mock.on('GET',`/v1/meals/${MEAL_ID}`,ok({meal:meal({allowedActions:[]}),myApplication:null,conversationId:null}));
 await renderApp(app,<MealDetailScreen/>);await screen.findByText('Sunday dinner');
 expect(app.services.session.getState().status).toBe('unavailable');
 expect(screen.queryByRole('button',{name:'Request to join'})).toBeNull();
});
