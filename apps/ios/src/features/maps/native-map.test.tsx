import {render} from '@testing-library/react-native';
import {NativeMap,regionBounds} from './NativeMap.tsx';
it('keeps Places content off MapKit when Google native configuration is unavailable',async()=>{
 const ui=await render(<NativeMap points={[{id:'p',title:'Real server place',lat:51.5,lng:-0.1}]} onSelect={jest.fn()}/>);
 expect(ui.getByText(/Map unavailable/)).toBeTruthy();expect(ui.queryByTestId('native-map')).toBeNull();
});
it('clamps latitude and wraps antimeridian bounds for explicit area searches',()=>{
 expect(regionBounds({latitude:85,longitude:179,latitudeDelta:20,longitudeDelta:8})).toEqual({north:90,south:75,east:-177,west:175});
});
