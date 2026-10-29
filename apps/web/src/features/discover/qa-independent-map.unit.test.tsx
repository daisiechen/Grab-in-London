/** Actual Discover map: the illustrated central-London artwork with area count pins (iOS IllustratedMap). */
import { it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, page } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { meal, MEAL_ID } from '../../test/fixtures.ts';

it('QA-DISCOVERY-001 QA-DISCOVERY-004 two meals share map/list; choosing a pin never opens detail or writes anything', async () => {
  const a = meal({ title: 'QA map A', capacity: 6, confirmedCount: 3 }), b = meal({ id: '99999999-9999-4999-8999-999999999999', title: 'QA map B', areaCode: 'fitzrovia' });
  const c = meal({ id: '88888888-8888-4888-8888-888888888888', title: 'QA unmapped', areaCode: 'hackney' });
  const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED'), discoverMeals: () => page([a, b, c]) });
  renderApp(stub.fetch, '/discover?languages=en');
  expect(await screen.findByRole('img', { name: 'Illustrated map of central London' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: /: 1 meal$/ }).map((p) => p.getAttribute('aria-label')).sort()).toEqual(['Fitzrovia: 1 meal', 'Soho: 1 meal']);
  expect(screen.getByText(/Some restaurants have no map position yet/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Fitzrovia: 1 meal' }));
  expect(screen.getByRole('heading', { name: '1 meal in Fitzrovia' })).toBeTruthy();
  expect(stub.callsTo('getMeal')).toHaveLength(0);
  expect(stub.callsTo('discoverMeals')).toHaveLength(1);
  expect(stub.callsTo('createMeal')).toHaveLength(0);
  await userEvent.click(screen.getByRole('button', { name: 'List view' }));
  expect(screen.getByRole('link', { name: 'Open QA map A' }).getAttribute('href')).toBe(`/meals/${MEAL_ID}/qa-map-a`);
  expect(screen.getByRole('link', { name: 'Open QA unmapped' })).toBeTruthy();
});
