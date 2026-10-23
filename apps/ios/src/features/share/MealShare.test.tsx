import {fireEvent,render,screen} from '@testing-library/react-native';
import {Share} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {MealShare} from './MealShare.tsx';
jest.mock('expo-clipboard',()=>({setStringAsync:jest.fn()}));
const origin='https://p11-share.example.invalid',id='14141414-1414-4141-8141-141414141414';
const meal={id,title:'Friday supper',startsAt:{localDate:'2026-10-25',localTime:'01:30',utcOffsetMinutes:0},area:'Soho, London',status:'OPEN' as const};
afterEach(()=>jest.restoreAllMocks());
it('copies an explicit public link and keeps selectable text when copying fails',async()=>{
 const copy=jest.mocked(Clipboard.setStringAsync);copy.mockReset();copy.mockResolvedValue(false);
 await render(<MealShare meal={meal} origin={origin}/>);
 expect(copy).not.toHaveBeenCalled();await fireEvent.press(screen.getByRole('button',{name:'Share meal'}));
 await fireEvent.press(screen.getByRole('button',{name:'Copy link for WeChat'}));
 expect(await screen.findByText(/Couldn’t copy/)).toBeOnTheScreen();expect(screen.getByLabelText('Meal link')).toHaveProp('selectable',true);
 copy.mockResolvedValue(true);await fireEvent.press(screen.getByRole('button',{name:'Copy link'}));
 expect(await screen.findByText('Copied.')).toBeOnTheScreen();expect(copy).toHaveBeenLastCalledWith(`${origin}/meals/${id}`);
});
it('dismissed native sharing never claims delivery or copies silently',async()=>{
 const copy=jest.mocked(Clipboard.setStringAsync);copy.mockReset();
 const share=jest.spyOn(Share,'share').mockResolvedValue({action:Share.dismissedAction,activityType:undefined});
 await render(<MealShare meal={{...meal,status:'CANCELLED'}} origin={origin}/>);
 await fireEvent.press(screen.getByRole('button',{name:'Share meal'}));await fireEvent.press(screen.getByRole('button',{name:'More sharing options'}));
 expect(share).toHaveBeenCalledWith(expect.objectContaining({url:`${origin}/meals/${id}`,message:expect.stringContaining('Cancelled')}));
 expect(copy).not.toHaveBeenCalled();expect(screen.queryByText(/^Sent|^Shared|^Copied/)).toBeNull();
});
