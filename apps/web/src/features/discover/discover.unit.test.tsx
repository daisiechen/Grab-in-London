import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, page } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { MEAL_ID, meal, session } from '../../test/fixtures.ts';
import { emptyFilters, filtersToParams, filtersToQuery, parseFilters, upcomingLondonDates } from './filters.ts';

const guest = () => fail(401, 'AUTH_REQUIRED');

describe('discover filters (T08)', () => {
  it('drops unknown values from links and serialises comma lists', () => {
    const f = parseFilters(new URLSearchParams('languages=zh,xx&tableSizes=2,9,2&moods=BOGUS&dates=2026-10-24,bad&budgetMaxPence=3000&cuisineCodes=CHINESE'));
    expect(f).toMatchObject({ languages: ['zh'], tableSizes: [2], moods: [], dates: ['2026-10-24'], budgetMaxPence: 3000, cuisineCodes: ['CHINESE'] });
    expect(filtersToQuery(f)).toEqual({ languages: 'zh', tableSizes: '2', dates: '2026-10-24', budgetMaxPence: 3000, cuisineCodes: 'CHINESE' });
    expect(filtersToQuery(emptyFilters)).toEqual({});
  });
  it('round-trips through the URL while keeping unrelated params', () => {
    const f = { ...emptyFilters, dietaryCodes: ['VEGAN' as const], keyword: ' dumplings ' };
    const p = filtersToParams(f, new URLSearchParams('view=areas'));
    expect(p.get('view')).toBe('areas');
    expect(parseFilters(p)).toMatchObject({ dietaryCodes: ['VEGAN'], keyword: 'dumplings' });
  });
  it('builds London calendar dates across the October clock change', () => {
    expect(upcomingLondonDates(3, Date.parse('2026-10-24T23:30:00Z'))).toEqual(['2026-10-25', '2026-10-26', '2026-10-27']);
  });
});

describe('Discover page (T08)', () => {
  it('lets guests browse the public projection', async () => {
    const stub = createFetchStub({ getSession: guest, discoverMeals: () => page([meal()]) });
    renderApp(stub.fetch, '/discover');
    expect(await screen.findByRole('heading', { name: 'Friday dinner & new faces' })).toBeTruthy();
    expect(screen.getByText('25–40 per person')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Friday dinner & new faces' }).getAttribute('href')).toBe(`/meals/${MEAL_ID}/friday-dinner-and-new-faces`);
    expect(stub.callsTo('discoverMeals')[0]!.url.search).toBe('');
  });

  it('applies pending filters only on “Show meals”; closing discards them', async () => {
    const stub = createFetchStub({ getSession: guest, discoverMeals: () => page([meal()]) });
    renderApp(stub.fetch, '/discover');
    await screen.findByRole('heading', { name: 'Friday dinner & new faces' });
    await userEvent.click(screen.getByRole('button', { name: 'More filters' }));
    let dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('Vegan'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(stub.callsTo('discoverMeals')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'More filters' }));
    dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText('Vegan') as HTMLInputElement).checked).toBe(false);
    await userEvent.click(within(dialog).getByLabelText('Vegan'));
    await userEvent.click(within(within(dialog).getByRole('group', { name: 'Conversation language' })).getByLabelText('Chinese'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Show meals' }));
    await waitFor(() => expect(stub.callsTo('discoverMeals')).toHaveLength(2));
    const q = stub.callsTo('discoverMeals')[1]!.url.searchParams;
    expect(q.get('dietaryCodes')).toBe('VEGAN');
    expect(q.get('languages')).toBe('zh');
    expect(await screen.findByRole('button', { name: 'More filters, 2 active' })).toBeTruthy();
  });

  it('restores applied filters from the URL (back navigation)', async () => {
    const stub = createFetchStub({ getSession: guest, discoverMeals: () => page([]) });
    renderApp(stub.fetch, '/discover?tableSizes=2&timeOfDay=dinner&moods=BOGUS');
    expect(await screen.findByText('No meals found')).toBeTruthy();
    const q = stub.callsTo('discoverMeals')[0]!.url.searchParams;
    expect(q.get('tableSizes')).toBe('2');
    expect(q.get('timeOfDay')).toBe('dinner');
    expect(q.has('moods')).toBe(false);
    expect(screen.getByRole('button', { name: 'Filter by table size' }).textContent).toContain('2 people');
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(stub.callsTo('discoverMeals')).toHaveLength(2));
    expect(stub.callsTo('discoverMeals')[1]!.url.search).toBe('');
  });

  it('pins the same results by area on the illustrated map and lists the chosen area first', async () => {
    const stub = createFetchStub({
      getSession: guest,
      discoverMeals: () => page([meal(), meal({ id: '99999999-9999-4999-8999-999999999999', title: 'Brunch in Covent Garden', areaCode: 'covent-garden' })]),
    });
    renderApp(stub.fetch, '/discover');
    await userEvent.click(await screen.findByRole('button', { name: 'Covent Garden: 1 meal' }));
    expect(screen.getByRole('button', { name: 'Covent Garden: 1 meal' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: '1 meal in Covent Garden' })).toBeTruthy();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Brunch in Covent Garden', 'Friday dinner & new faces']);
    expect(screen.getByText('More nearby')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'View all in list' }));
    expect(await screen.findByRole('heading', { name: 'A seat for you' })).toBeTruthy();
  });

  it('loads further pages with the opaque cursor', async () => {
    let n = 0;
    const stub = createFetchStub({
      getSession: guest,
      discoverMeals: () => (++n === 1 ? page([meal()], 'cursor-2') : page([meal({ id: '99999999-9999-4999-8999-999999999999', title: 'Second page meal' })])),
    });
    renderApp(stub.fetch, '/discover?view=list');
    await userEvent.click(await screen.findByRole('button', { name: 'Show more meals' }));
    expect(await screen.findByRole('heading', { name: 'Second page meal' })).toBeTruthy();
    expect(stub.callsTo('discoverMeals')[1]!.url.searchParams.get('cursor')).toBe('cursor-2');
  });

  it('shows a retryable error when discovery fails', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), discoverMeals: () => fail(503, 'PROVIDER_UNAVAILABLE') });
    renderApp(stub.fetch, '/discover');
    expect(await screen.findByText('We couldn’t load meals.')).toBeTruthy();
  });
});
