/** Actual Create page (not a standalone replacement): planned-time interactions and draft ownership. */
import {it,expect} from 'vitest';
import {screen,waitFor} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {createFetchStub,ok} from '../../test/fetchStub.ts';
import {renderApp} from '../../test/render.tsx';
import {session} from '../../test/fixtures.ts';
import {saveDraft,loadDraft} from '../../lib/drafts.ts';
import {addDays,londonToday} from '../../lib/london.ts';
import {newDraft,type MealDraft} from './model.ts';
it('QA-CREATE-004 actual Create planned-time grid has 48 slots, focuses the selection, keyboard moves, Enter and Escape close back to the trigger',async()=>{
 const day=addDays(londonToday(),5);
 saveDraft('create',{...newDraft(),date:day,time:'18:30',closeDate:day,closeTime:'17:30'});const stub=createFetchStub({getSession:()=>ok(session())});renderApp(stub.fetch,'/create');
 const trigger=await screen.findByRole('button',{name:'Time: 18:30'});await userEvent.click(trigger);
 const grid=await screen.findByRole('group',{name:'Meal time'});expect(grid.querySelectorAll('input[type=radio]')).toHaveLength(48);
 expect(document.activeElement).toBe(screen.getByRole('radio',{name:'18:30'}));expect((screen.getByRole('radio',{name:'18:30'}) as HTMLInputElement).checked).toBe(true);
 await userEvent.keyboard('{Escape}');expect(screen.queryByRole('group',{name:'Meal time'})).toBeNull();expect(document.activeElement).toBe(screen.getByRole('button',{name:'Time: 18:30'}));expect(loadDraft<MealDraft>('create')?.time).toBe('18:30');
 await userEvent.click(screen.getByRole('button',{name:'Time: 18:30'}));await userEvent.keyboard('{ArrowRight}');
 // Arrow keys move the choice without closing; Enter confirms and returns to the trigger.
 expect(screen.getByRole('group',{name:'Meal time'})).toBeTruthy();await userEvent.keyboard('{Enter}');
 await waitFor(()=>expect(loadDraft<MealDraft>('create')).toMatchObject({time:'19:00',closeTime:'18:00'}));expect(screen.queryByRole('group',{name:'Meal time'})).toBeNull();
 expect(document.activeElement).toBe(screen.getByRole('button',{name:'Time: 19:00'}));expect(stub.callsTo('createMeal')).toHaveLength(0);
});
