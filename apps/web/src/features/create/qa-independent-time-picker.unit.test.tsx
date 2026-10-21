/** Actual Create page (not a standalone replacement): planned-time interactions and draft ownership. */
import {it,expect} from 'vitest';
import {screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {createFetchStub,ok} from '../../test/fetchStub.ts';
import {renderApp} from '../../test/render.tsx';
import {session} from '../../test/fixtures.ts';
import {saveDraft,loadDraft} from '../../lib/drafts.ts';
import {newDraft,type MealDraft} from './model.ts';
it('QA-CREATE-004 actual Create planned-time menu has48 slots selected focus keyboard cancel choose and outside close',async()=>{
 saveDraft('create',{...newDraft(),date:'2026-10-24',time:'18:30',closeDate:'2026-10-24',closeTime:'17:30'});const stub=createFetchStub({getSession:()=>ok(session())});renderApp(stub.fetch,'/create');
 const trigger=await screen.findByRole('combobox',{name:'Time'});await userEvent.click(trigger);expect(await screen.findByRole('listbox',{name:'Time'})).toBeTruthy();expect(screen.getAllByRole('option')).toHaveLength(48);expect(document.activeElement?.textContent).toBe('18:30');expect(screen.getByRole('option',{name:'18:30'}).getAttribute('aria-selected')).toBe('true');
 await userEvent.keyboard('{ArrowDown}{Escape}');expect(screen.queryByRole('listbox')).toBeNull();expect(document.activeElement).toBe(trigger);expect(loadDraft<MealDraft>('create')?.time).toBe('18:30');
 await userEvent.click(trigger);await userEvent.keyboard('{ArrowDown}{Enter}');expect(loadDraft<MealDraft>('create')).toMatchObject({time:'19:00',closeTime:'18:00'});expect(screen.queryByRole('listbox')).toBeNull();
 await userEvent.click(trigger);await userEvent.click(screen.getByRole('heading',{name:'A place at your table.'}));expect(screen.queryByRole('listbox')).toBeNull();expect(loadDraft<MealDraft>('create')?.time).toBe('19:00');expect(stub.callsTo('createMeal')).toHaveLength(0);
});
