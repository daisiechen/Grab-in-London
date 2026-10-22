import {act,fireEvent,screen,waitFor} from '@testing-library/react-native';
import {useState} from 'react';
import {Linking,Pressable,Text} from 'react-native';
import {RestaurantPhoto} from './RestaurantPhoto.tsx';
import {MealCard} from './MealCard.tsx';
import {createTestApp,renderApp} from '../test/render.tsx';
import {meal} from '../test/fixtures.ts';
import {fail,ok,type MockReply} from '../test/mock-fetch.ts';
const ref='2c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f',path=`/v1/venues/${ref}/photo`;
const photo=(uri='https://photos.example.invalid/one')=>({placeId:'place-1',photo:{uri,source:'Google Maps',authorAttributions:[{displayName:'Photo Author',uri:'https://maps.google.com/author'}]}});
const view=()=> <RestaurantPhoto venueRef={ref} placeId="place-1" name="Dishoom"/>;
it('shows the selected restaurant photo with visible source and author, opening author only on explicit press',async()=>{
 const app=createTestApp(),open=jest.spyOn(Linking,'openURL').mockResolvedValue(undefined);app.mock.on('GET',path,ok(photo()));
 await renderApp(app,view());const image=await screen.findByLabelText('Photo of Dishoom');expect(image.props.source).toMatchObject({cache:'reload',headers:{'Cache-Control':'no-store'}});expect(screen.getByText('Google Maps')).toBeOnTheScreen();expect(open).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole('link',{name:'Photo by Photo Author'}));expect(open).toHaveBeenCalledWith('https://maps.google.com/author');open.mockRestore();
});
it('refreshes an expired image only once and then uses an honest placeholder',async()=>{
 const app=createTestApp();app.mock.on('GET',path,ok(photo()),1).on('GET',path,ok(photo('https://photos.example.invalid/two')),1);
 await renderApp(app,view());await fireEvent(await screen.findByLabelText('Photo of Dishoom'),'error');await waitFor(()=>expect(app.mock.callsTo('GET',path)).toHaveLength(2));
 await waitFor(()=>expect(screen.getByLabelText('Photo of Dishoom').props.source.uri).toBe('https://photos.example.invalid/two'));
 await fireEvent(screen.getByLabelText('Photo of Dishoom'),'error');expect(await screen.findByLabelText('Restaurant photo unavailable')).toBeOnTheScreen();expect(app.mock.callsTo('GET',path)).toHaveLength(2);
});
it.each([ok({placeId:'place-1',photo:null}),fail(503,'PROVIDER_UNAVAILABLE'),ok({...photo(),placeId:'another-place'})])('falls back without retrying a null, unavailable or mismatched restaurant response',async response=>{
 const app=createTestApp();app.mock.on('GET',path,response);await renderApp(app,view());await waitFor(()=>expect(app.mock.callsTo('GET',path)).toHaveLength(1));expect(screen.getByLabelText('Restaurant photo unavailable')).toBeOnTheScreen();expect(screen.queryByText('Photo Author')).toBeNull();
});
it('discards a late old-place response after selection changes',async()=>{
 const app=createTestApp();let release!:(v:MockReply)=>void;app.mock.on('GET',path,()=>new Promise(resolve=>{release=resolve;}));
 const other='3c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f';app.mock.on('GET',`/v1/venues/${other}/photo`,ok({placeId:'place-2',photo:{...photo().photo,uri:'https://photos.example.invalid/new'}}));
 function Switch(){const [changed,setChanged]=useState(false);return <><Pressable accessibilityRole="button" onPress={()=>setChanged(true)}><Text>Change restaurant</Text></Pressable>{changed?<RestaurantPhoto venueRef={other} placeId="place-2" name="New restaurant"/>:view()}</>;}
 await renderApp(app,<Switch/>);await waitFor(()=>expect(app.mock.callsTo('GET',path)).toHaveLength(1));
 await fireEvent.press(screen.getByRole('button',{name:'Change restaurant'}));
 await screen.findByLabelText('Photo of New restaurant');await act(async()=>release(ok(photo())));expect(screen.queryByLabelText('Photo of Dishoom')).toBeNull();
});
it('places clickable card attribution outside the meal navigation Pressable',async()=>{
 const app=createTestApp(),navigate=jest.fn(),open=jest.spyOn(Linking,'openURL').mockResolvedValue(undefined);app.mock.on('GET',path,ok(photo()));
 await renderApp(app,<MealCard meal={meal()} onPress={navigate}/>);const author=await screen.findByRole('link',{name:'Photo by Photo Author'});
 let parent=author.parent;while(parent){expect(parent.props.onPress).not.toBe(navigate);parent=parent.parent;}
 await fireEvent.press(author);expect(navigate).not.toHaveBeenCalled();expect(open).toHaveBeenCalledTimes(1);open.mockRestore();
});

it('immediately removes an already displayed old restaurant photo and author while the new restaurant loads',async()=>{
 const app=createTestApp(),other='4c1b0a9f-8e7d-4c6b-9a5f-4e3d2c1b0a9f';let release!:(v:MockReply)=>void;
 app.mock.on('GET',path,ok(photo())).on('GET',`/v1/venues/${other}/photo`,()=>new Promise(resolve=>{release=resolve;}));
 function Switch(){const [changed,setChanged]=useState(false);return <><Pressable accessibilityRole="button" onPress={()=>setChanged(true)}><Text>Switch displayed restaurant</Text></Pressable>{changed?<RestaurantPhoto venueRef={other} placeId="place-new" name="New restaurant"/>:view()}</>;}
 await renderApp(app,<Switch/>);await screen.findByLabelText('Photo of Dishoom');expect(screen.getByRole('link',{name:'Photo by Photo Author'})).toBeOnTheScreen();
 await fireEvent.press(screen.getByRole('button',{name:'Switch displayed restaurant'}));
 expect(screen.queryByLabelText('Photo of Dishoom')).toBeNull();expect(screen.queryByRole('link',{name:'Photo by Photo Author'})).toBeNull();expect(screen.queryByText('Google Maps')).toBeNull();expect(screen.getByLabelText('Restaurant photo unavailable')).toBeOnTheScreen();
 await act(async()=>release(ok({placeId:'place-new',photo:{...photo().photo,uri:'https://photos.example.invalid/new-place',authorAttributions:[{displayName:'New Author',uri:'https://maps.google.com/new-author'}]}})));
 expect(await screen.findByLabelText('Photo of New restaurant')).toBeOnTheScreen();expect(screen.getByRole('link',{name:'Photo by New Author'})).toBeOnTheScreen();expect(screen.queryByText('Photo Author')).toBeNull();
});
it('rejects a non-HTTPS image URI with a placeholder and never opens its author link',async()=>{
 const app=createTestApp(),open=jest.spyOn(Linking,'openURL').mockResolvedValue(undefined);app.mock.on('GET',path,ok(photo('http://photos.example.invalid/insecure')));
 await renderApp(app,view());await waitFor(()=>expect(app.mock.callsTo('GET',path)).toHaveLength(1));expect(screen.getByLabelText('Restaurant photo unavailable')).toBeOnTheScreen();expect(screen.queryByRole('link')).toBeNull();expect(open).not.toHaveBeenCalled();open.mockRestore();
});
