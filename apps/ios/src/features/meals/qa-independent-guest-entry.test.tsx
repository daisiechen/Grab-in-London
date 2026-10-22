import {fireEvent,screen} from '@testing-library/react-native';
import {MealDetailScreen} from './MealDetailScreen.tsx';
import {createTestApp,renderApp} from '../../test/render.tsx';
import {mockRouter,resetRouter,routeParams} from '../../test/router.ts';
import {ok} from '../../test/mock-fetch.ts';
import {MEAL_ID,meal} from '../../test/fixtures.ts';
import {clearReturnTo,peekReturnTo} from '../auth/intent.ts';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- isolated router factory
jest.mock('expo-router',()=>require('../../test/router.ts').expoRouterMock);
it('QA-F48: real guest projection with no APPLY action retains a login entry and exact original target without sending',async()=>{
 resetRouter();clearReturnTo();routeParams.current={mealId:MEAL_ID};
 const app=createTestApp();await app.services.session.restore();
 app.mock.on('GET',`/v1/meals/${MEAL_ID}`,ok({meal:meal({allowedActions:[]}),myApplication:null,conversationId:null}));
 await renderApp(app,<MealDetailScreen/>);await screen.findByText('Sunday dinner');
 await fireEvent.press(screen.getByRole('button',{name:'Request to join'}));
 expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');expect(peekReturnTo()).toBe(`/meals/${MEAL_ID}/apply`);
 expect(app.mock.callsTo('POST',/applications/)).toHaveLength(0);
});
