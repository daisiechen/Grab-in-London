/** Actual router navigation; no mocked Discover/detail components. Controlled API projections only. */
import { it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, page } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { meal, publicProfile } from '../../test/fixtures.ts';

it('QA-DISCOVERY-001 detail Back restores applied filters, list view and the selected area', async () => {
  const m = meal({ title: 'QA Covent Garden table', areaCode: 'covent-garden' }), other = meal({ id: '99999999-9999-4999-8999-999999999999', title: 'QA Soho table', areaCode: 'soho' });
  const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED'), discoverMeals: () => page([m, other]), getMeal: () => ok({ meal: m, myApplication: null, conversationId: null }), getPublicProfile: () => ok({ profile: publicProfile(), reviews: [], nextReviewCursor: null }), getVenuePhoto: () => ok({ placeId: 'place-1', photo: null }) });
  renderApp(stub.fetch, '/discover?languages=en');
  await userEvent.click(await screen.findByRole('button', { name: 'Covent Garden: 1 meal' }));
  await userEvent.click(screen.getByRole('link', { name: 'Open QA Covent Garden table' }));
  expect(await screen.findByRole('heading', { name: 'QA Covent Garden table', level: 1 })).toBeTruthy();
  await userEvent.click(screen.getByRole('link', { name: 'Your host, Maya Chen' }));
  await screen.findByRole('heading', { name: 'Maya Chen', level: 1 });
  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  await screen.findByRole('heading', { name: 'QA Covent Garden table', level: 1 });
  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  await screen.findByRole('heading', { name: 'Fancy a bite?' });
  expect(screen.getByRole('button', { name: 'More filters, 1 active' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Covent Garden: 1 meal' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('heading', { name: '1 meal in Covent Garden' })).toBeTruthy();
  expect(stub.callsTo('discoverMeals').at(-1)!.url.searchParams.get('languages')).toBe('en');
  expect(stub.callsTo('applyMeal')).toHaveLength(0);
});
