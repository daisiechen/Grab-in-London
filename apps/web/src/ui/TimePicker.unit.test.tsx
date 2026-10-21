import {useState} from 'react';
import {render,screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {expect,it} from 'vitest';
import {TimePicker} from './TimePicker.tsx';
const options=Array.from({length:48},(_,i)=>`${String(Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`);
function Example({initial=''}:{initial?:string}){const [value,setValue]=useState(initial);return <><label htmlFor="time">Time</label><TimePicker id="time" options={options} value={value} onChange={setValue}/><button>Outside</button></>;}
it('opens 48 half-hour options at midnight without committing and closes on Escape',async()=>{
 render(<Example/>);const trigger=screen.getByRole('combobox',{name:'Time'});await userEvent.click(trigger);
 expect(screen.getAllByRole('option')).toHaveLength(48);expect(document.activeElement).toBe(screen.getByRole('option',{name:'00:00'}));
 await userEvent.keyboard('{Escape}');expect(screen.queryByRole('listbox')).toBeNull();expect(trigger.textContent).toContain('Choose a time');expect(document.activeElement).toBe(trigger);
});
it('focuses the selection and supports arrows Home End Enter without losing the chosen value',async()=>{
 render(<Example initial="19:30"/>);const trigger=screen.getByRole('combobox',{name:'Time'});await userEvent.click(trigger);
 expect(document.activeElement).toBe(screen.getByRole('option',{name:'19:30'}));await userEvent.keyboard('{Home}{ArrowDown}{Enter}');expect(trigger.textContent).toContain('00:30');
 await userEvent.click(trigger);await userEvent.keyboard('{End}{ArrowUp}{Enter}');expect(trigger.textContent).toContain('23:00');
});
it('closes on outside pointer and Tab without changing the current selection',async()=>{
 render(<Example initial="12:00"/>);const trigger=screen.getByRole('combobox',{name:'Time'});await userEvent.click(trigger);await userEvent.click(screen.getByRole('button',{name:'Outside'}));expect(screen.queryByRole('listbox')).toBeNull();
 await userEvent.click(trigger);await userEvent.keyboard('{Tab}');expect(screen.queryByRole('listbox')).toBeNull();expect(trigger.textContent).toContain('12:00');
});
