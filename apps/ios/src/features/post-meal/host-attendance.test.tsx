import {act,fireEvent,screen,waitFor,within} from '@testing-library/react-native';
import {PostMealScreen} from './PostMealScreen.tsx';
import {createTestApp,renderApp,signIn} from '../../test/render.tsx';
import {resetRouter,routeParams} from '../../test/router.ts';
import {HOST_ID,USER_ID,MEAL_ID,meal,publicProfile} from '../../test/fixtures.ts';
import {ok,fail} from '../../test/mock-fetch.ts';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- shared Jest router mock factory
jest.mock('expo-router',()=>require('../../test/router.ts').expoRouterMock);
const PATH=`/v1/meals/${MEAL_ID}/post-meal`,WRITE=`/v1/meals/${MEAL_ID}/attendance/${HOST_ID}`;
const state=(extra:object={})=>({mealId:MEAL_ID,windowOpensAt:'2026-10-21T18:00:00Z',windowClosesAt:'2026-10-28T18:00:00Z',windowOpen:true,eligibleMembers:[publicProfile(USER_ID,'Alex'),publicProfile(HOST_ID,'Maya')],attendance:[{subjectId:USER_ID,value:'unknown',source:null,selfValue:null,hostValue:null,version:'0'},{subjectId:HOST_ID,value:'present',source:'SELF',selfValue:'present',hostValue:null,version:'3'}],experience:null,reviews:[],reconnect:[],...extra});
async function setup(host:boolean|null=true,closed=false,extra:object={}){resetRouter();routeParams.current={mealId:MEAL_ID};const app=createTestApp();await signIn(app);app.mock.on('GET',PATH,ok(state({windowOpen:!closed,...extra})),1);app.mock.on('GET',`/v1/meals/${MEAL_ID}`,host===null?fail(503,'PROVIDER_UNAVAILABLE'):ok({meal:meal({host:publicProfile(host?USER_ID:HOST_ID)})}));await renderApp(app,<PostMealScreen/>);await screen.findByText('How was your table?');return app;}
async function choose(value:'present'|'absent'='absent'){await fireEvent.press(await screen.findByRole('radio',{name:value==='present'?'Maya came':'Maya didn’t come'}));await fireEvent.press(screen.getByRole('button',{name:'Review attendance for Maya'}));}
async function confirm(){await fireEvent.press(screen.getByRole('button',{name:'Confirm attendance report'}));}
test('ordinary member and failed host lookup never expose host controls',async()=>{await setup(false);expect(screen.queryByText('Report your table’s attendance')).toBeNull();});
test('failed host lookup preserves self reporting without granting host actions',async()=>{await setup(null);expect(screen.queryByText('Report your table’s attendance')).toBeNull();expect(screen.getByRole('radio',{name:'I attended'})).toBeTruthy();});
test('closed window has no host reports',async()=>{await setup(true,true);expect(screen.queryByText('Report your table’s attendance')).toBeNull();});
test('unknown is unselected; host explicitly confirms, SELF remains effective and other drafts remain',async()=>{const app=await setup();const review=await screen.findByRole('button',{name:'Review attendance for Maya'});expect(review).toBeDisabled();expect(screen.getByRole('radio',{name:'Maya didn’t come'}).props.accessibilityState.selected).toBe(false);await choose();await fireEvent.press(screen.getByRole('button',{name:'Keep editing'}));expect(app.mock.callsTo('PUT',WRITE)).toHaveLength(0);app.mock.on('PUT',WRITE,ok({subjectId:HOST_ID,value:'present',source:'SELF',selfValue:'present',hostValue:'absent',version:'4'}));app.mock.on('GET',PATH,ok(state({attendance:[state().attendance[0],{...state().attendance[1],hostValue:'absent',version:'4'}]})));await fireEvent.press(screen.getByRole('button',{name:'Review attendance for Maya'}));await confirm();await screen.findByText('Host report saved. Each member’s own report takes priority.');expect(app.mock.callsTo('PUT',WRITE)[0]?.headers['if-match']).toBe('"3"');expect(app.mock.callsTo('PUT',WRITE)[0]?.body).toEqual({value:'absent'});expect(screen.getByText(/Maya · Came · they reported/)).toBeTruthy();});
test('409 rereads and requires a fresh explicit confirmation/version',async()=>{const app=await setup();app.mock.on('PUT',WRITE,fail(409,'VERSION_CONFLICT'),1);app.mock.on('GET',PATH,ok(state({attendance:[state().attendance[0],{...state().attendance[1],version:'5'}]})));await choose('present');await confirm();await screen.findByText('Attendance changed. Review the refreshed facts and confirm again.');expect(app.mock.callsTo('PUT',WRITE)).toHaveLength(1);expect(screen.queryByRole('button',{name:'Confirm attendance report'})).toBeNull();app.mock.on('PUT',WRITE,ok({...state().attendance[1],version:'6',hostValue:'present'}));await fireEvent.press(screen.getByRole('button',{name:'Review attendance for Maya'}));await confirm();await screen.findByText('Host report saved. Each member’s own report takes priority.');expect(app.mock.callsTo('PUT',WRITE)[1]?.headers['if-match']).toBe('"5"');});
test('failed conflict refresh blocks old confirmation and can recover through explicit read-only reload',async()=>{const app=await setup();app.mock.on('PUT',WRITE,fail(409,'VERSION_CONFLICT'),1);app.mock.on('GET',PATH,fail(503,'PROVIDER_UNAVAILABLE'),1);await choose();await confirm();await screen.findByText('We couldn’t refresh attendance. Reload attendance before confirming another report.');expect(screen.getByRole('button',{name:'Review attendance for Maya'})).toBeDisabled();app.mock.on('GET',PATH,ok(state()));await waitFor(()=>expect(screen.getByRole('button',{name:'Reload attendance'})).toBeEnabled());await fireEvent.press(screen.getByRole('button',{name:'Reload attendance'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Review attendance for Maya'})).toBeEnabled());expect(app.mock.callsTo('PUT',WRITE)).toHaveLength(1);});
test('ordinary failure is visible inside confirmation and retains chosen fact',async()=>{const app=await setup();app.mock.on('PUT',WRITE,fail(503,'PROVIDER_UNAVAILABLE'));await choose();await confirm();await screen.findByText('We couldn’t save this host report. Your selection is kept.');const sheet=screen.getByRole('header',{name:'Report attendance for Maya?'}).parent?.parent;if(!sheet)throw Error('sheet');expect(within(sheet).getByText('We couldn’t save this host report. Your selection is kept.')).toBeTruthy();await fireEvent.press(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByRole('radio',{name:'Maya didn’t come'}).props.accessibilityState.selected).toBe(true);});

test('saving a host fact does not discard private experience or reference drafts',async()=>{
 const attendance=[{...state().attendance[0],value:'present',source:'SELF',selfValue:'present'},state().attendance[1]];
 const app=await setup(true,false,{attendance});
 app.mock.on('PUT',`/v1/meals/${MEAL_ID}/experience`,ok({version:'1',updatedAt:'2026-10-26T10:00:00Z'}));
 app.mock.on('GET',PATH,ok(state({attendance,experience:{score:4,version:'1'}})),1);
 await fireEvent.press(screen.getByRole('radio',{name:'4'}));await within(screen.getByTestId('exp-status')).findByText('Saved');
 await fireEvent.changeText(screen.getByLabelText('Reference for Maya'),'A retained reference draft');
 app.mock.on('PUT',WRITE,ok({...state().attendance[1],version:'4',hostValue:'absent'}));
 app.mock.on('GET',PATH,ok(state({attendance:[attendance[0],{...attendance[1],version:'4',hostValue:'absent'}]})));
 await choose();await confirm();await screen.findByText('Host report saved. Each member’s own report takes priority.');
 expect(screen.getByDisplayValue('A retained reference draft')).toBeTruthy();expect(screen.getByRole('radio',{name:'4'}).props.accessibilityState.selected).toBe(true);
});
test('conflict discovering closed reporting window removes host actions without replay',async()=>{const app=await setup();app.mock.on('PUT',WRITE,fail(409,'STATE_CONFLICT'));app.mock.on('GET',PATH,ok(state({windowOpen:false})));await choose();await confirm();await screen.findByText('The feedback window for this meal has closed.');expect(screen.queryByText('Report your table’s attendance')).toBeNull();expect(app.mock.callsTo('PUT',WRITE)).toHaveLength(1);});

test('late post-meal response after session expiry cannot refill private cache',async()=>{
 resetRouter();routeParams.current={mealId:MEAL_ID};const app=createTestApp();await signIn(app);
 let release!:(value:ReturnType<typeof ok>)=>void;const pending=new Promise<ReturnType<typeof ok>>(resolve=>{release=resolve;});
 app.mock.on('GET',PATH,()=>pending);app.mock.on('GET',`/v1/meals/${MEAL_ID}`,fail(503,'PROVIDER_UNAVAILABLE'));
 await renderApp(app,<PostMealScreen/>);await waitFor(()=>expect(app.mock.callsTo('GET',PATH)).toHaveLength(1));
 await act(async()=>{await app.services.session.expire();release(ok(state()));});
 await waitFor(()=>expect(app.services.cache.get(`postMeal:${MEAL_ID}`)).toBeUndefined());
 expect(screen.queryByText('Report your table’s attendance')).toBeNull();
});
