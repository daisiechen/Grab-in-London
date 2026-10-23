import {afterEach,expect,it,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {MealShare} from './MealShare.tsx';
const origin='https://p11-share.example.invalid',id='14141414-1414-4141-8141-141414141414';
const meal={id,title:'Friday supper',startsAt:{localDate:'2026-10-25',localTime:'01:30',utcOffsetMinutes:0},area:'Soho, London',status:'OPEN' as const};
afterEach(()=>{Reflect.deleteProperty(navigator,'share');});
it('copies only a public link after an explicit click and exposes selectable fallback',async()=>{
 const user=userEvent.setup(),write=vi.spyOn(navigator.clipboard,'writeText').mockRejectedValue(new Error('denied'));
 render(<MealShare meal={meal} origin={origin}/>);
 expect(write).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Share meal'}));
 await user.click(screen.getByRole('button',{name:'Copy link for WeChat'}));
 expect(await screen.findByText(/Couldn’t copy/)).toBeTruthy();expect(screen.queryByText('Copied.')).toBeNull();
 expect((screen.getByLabelText('Meal link') as HTMLInputElement).value).toBe(`${origin}/meals/${id}`);
 write.mockResolvedValue();await user.click(screen.getByRole('button',{name:'Copy link'}));
 expect(await screen.findByText('Copied.')).toBeTruthy();expect(write).toHaveBeenLastCalledWith(`${origin}/meals/${id}`);
});
it('cancelling the native share sheet never claims sent or copies silently',async()=>{
 const user=userEvent.setup(),write=vi.spyOn(navigator.clipboard,'writeText');
 const share=vi.fn().mockRejectedValue(new DOMException('Cancelled','AbortError'));
 Object.defineProperty(navigator,'share',{value:share,configurable:true});
 render(<MealShare meal={meal} origin={origin}/>);await user.click(screen.getByRole('button',{name:'Share meal'}));
 await user.click(screen.getByRole('button',{name:'More sharing options'}));
 expect(share).toHaveBeenCalledOnce();expect(write).not.toHaveBeenCalled();expect(screen.queryByText(/System sharing isn’t available/)).toBeNull();expect(screen.queryByText(/^Sent|^Shared|^Copied/)).toBeNull();
 expect(screen.getByRole('link',{name:'WhatsApp'}).getAttribute('href')).toContain('https://wa.me/?text=');
});
it('falls back to copying for an unavailable share API and refuses an unsafe origin',async()=>{
 const user=userEvent.setup(),write=vi.spyOn(navigator.clipboard,'writeText').mockResolvedValue();
 const view=render(<MealShare meal={{...meal,status:'CANCELLED'}} origin={origin}/>);
 await user.click(screen.getByRole('button',{name:'Share meal'}));await user.click(screen.getByRole('button',{name:'More sharing options'}));
 expect(await screen.findByText('Copied.')).toBeTruthy();expect(write).toHaveBeenCalledOnce();
 expect((screen.getByLabelText('Invitation text') as HTMLTextAreaElement).value).toContain('Cancelled');
 view.unmount();render(<MealShare meal={meal} origin="http://unsafe.invalid"/>);
 await user.click(screen.getByRole('button',{name:'Share meal'}));expect(screen.getByText(/Sharing is temporarily unavailable/)).toBeTruthy();expect(screen.queryByRole('link',{name:'WhatsApp'})).toBeNull();
});

it('Escape closes the menu and restores focus to its named trigger',async()=>{
 const user=userEvent.setup();render(<MealShare meal={meal} origin={origin}/>);
 const trigger=screen.getByRole('button',{name:'Share meal'});await user.click(trigger);
 await screen.findByRole('dialog',{name:'Share this meal'});await user.keyboard('{Escape}');
 expect(screen.queryByRole('dialog')).toBeNull();expect(document.activeElement).toBe(trigger);
});
