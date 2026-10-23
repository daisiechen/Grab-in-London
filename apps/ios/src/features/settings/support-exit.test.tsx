import {fireEvent,render,screen} from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import {SUPPORT_EMAIL} from '@fancy/client';
import {SupportExit} from './SupportExit.tsx';
jest.mock('expo-clipboard',()=>({setStringAsync:jest.fn()}));
it('copies only the public support address, and does not claim a failed copy succeeded',async()=>{
 const copy=jest.mocked(Clipboard.setStringAsync);copy.mockReset();copy.mockResolvedValue(false);
 await render(<SupportExit reason="receiptUnavailable"/>);
 await fireEvent.press(screen.getByRole('button',{name:'Copy email address'}));
 expect(await screen.findByText(/Couldn’t copy/)).toBeOnTheScreen();expect(screen.queryByText('Copied.')).toBeNull();
 copy.mockResolvedValue(true);await fireEvent.press(screen.getByRole('button',{name:'Copy email address'}));
 expect(await screen.findByText('Copied.')).toBeOnTheScreen();expect(copy).toHaveBeenLastCalledWith(SUPPORT_EMAIL);
 expect(screen.getByLabelText(`Support email ${SUPPORT_EMAIL}`)).toHaveProp('selectable',true);
});
