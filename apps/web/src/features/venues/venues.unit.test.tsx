import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, page } from '../../test/fetchStub.ts';
import { renderWithProviders } from '../../test/render.tsx';
import { VENUE_REF, session } from '../../test/fixtures.ts';
import type { Venue } from '../../api/types.ts';
import { INITIAL_PICKER_BOUNDS, VenuePicker } from './VenuePicker.tsx';

const candidate = (placeId: string, name: string) => ({ placeId, name, address: `${name} St, London`, photoRefs: [], attributions: [{ provider: 'google', text: 'Powered by Google' }] });
const confirmed: Venue = { venueRef: VENUE_REF, placeId: 'p-1', available: true, name: 'Dishoom (confirmed)', address: '22 Kingly St, London W1B 5QP', location: null, areaCode: 'soho', attributions: [], displayExpiresAt: null };

function Harness() {
  const [venue, setVenue] = useState<Venue | null>(null);
  return <VenuePicker value={venue} onConfirm={setVenue} />;
}

async function searchFor(term: string) {
  await userEvent.click(screen.getByRole('button', { name: /Choose a restaurant/ }));
  await userEvent.type(await screen.findByLabelText('Search restaurants'), term);
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
}

describe('VenuePicker (T06, iOS picker)', () => {
  it('lists central London as soon as it opens, without typing', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), searchVenues: () => page([candidate('p-1', 'Dishoom'), candidate('p-2', 'Barrafina')]) });
    renderWithProviders(<Harness />, stub.fetch);
    await userEvent.click(screen.getByRole('button', { name: /Choose a restaurant/ }));
    expect(await screen.findByRole('button', { name: /Barrafina/ })).toBeTruthy();
    const params = stub.callsTo('searchVenues')[0]!.url.searchParams;
    expect(params.get('q')).toBeNull();
    expect(Number(params.get('north'))).toBe(INITIAL_PICKER_BOUNDS.north);
    expect(screen.getByText('2 restaurants · choose one to preview').getAttribute('role')).toBe('status');
  });
  it('retains transient search display when confirmation only returns durable place identity', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), searchVenues: () => page([candidate('p-1', 'Dishoom')]), confirmVenue: () => ok({ ...confirmed, name: null, address: null, location: null }) });
    renderWithProviders(<Harness />, stub.fetch);
    await searchFor('dish');
    await userEvent.click(await screen.findByRole('button', { name: /Dishoom/ }));
    await userEvent.click(screen.getByRole('button', { name: /Use Dishoom/ }));
    expect(await screen.findByText('Dishoom')).toBeTruthy();
    expect(screen.getByText('Dishoom St, London')).toBeTruthy();
    expect(screen.getByText(/Choosing a place doesn’t reserve a table\./)).toBeTruthy();
    expect(stub.callsTo('confirmVenue')[0]!.body).toEqual({ placeId: 'p-1' });
  });
  it('confirms by placeId only and shows the server-confirmed details', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      searchVenues: () => page([candidate('p-1', 'Dishoom'), candidate('p-2', 'Barrafina')]),
      confirmVenue: () => ok(confirmed),
    });
    renderWithProviders(<Harness />, stub.fetch);
    await searchFor('dish');
    await waitFor(() => expect(stub.callsTo('searchVenues').at(-1)!.url.searchParams.get('q')).toBe('dish'));
    expect((await screen.findAllByText('Powered by Google')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /Dishoom/ }));
    expect(stub.callsTo('confirmVenue')).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: /Use Dishoom/ }));
    await waitFor(() => expect(screen.getByText('Dishoom (confirmed)')).toBeTruthy());
    const call = stub.callsTo('confirmVenue')[0]!;
    expect(call.body).toEqual({ placeId: 'p-1' });
    expect(call.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps the confirmed restaurant when searching again, and offers no manual entry', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      searchVenues: () => page([candidate('p-1', 'Dishoom')]),
      confirmVenue: () => ok(confirmed),
    });
    renderWithProviders(<Harness />, stub.fetch);
    await searchFor('dish');
    await userEvent.click(await screen.findByRole('button', { name: /Dishoom/ }));
    await userEvent.click(screen.getByRole('button', { name: /Use Dishoom/ }));
    await screen.findByText('Dishoom (confirmed)');
    stub.on('searchVenues', () => page([]));
    await userEvent.click(screen.getByRole('button', { name: 'Change restaurant' }));
    await userEvent.type(await screen.findByLabelText('Search restaurants'), 'zzz');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No restaurants found. Try another name.')).toBeTruthy();
    expect(screen.getByText('Dishoom (confirmed)')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Keep current restaurant' }));
    expect(screen.queryByLabelText('Search restaurants')).toBeNull();
    expect(screen.queryByLabelText(/address/i)).toBeNull();
  });

  it('reports provider outages without a fallback', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), searchVenues: () => fail(503, 'PROVIDER_UNAVAILABLE') });
    renderWithProviders(<Harness />, stub.fetch);
    await userEvent.click(screen.getByRole('button', { name: /Choose a restaurant/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Restaurant search is temporarily unavailable. Try again shortly.');
  });

  it('refuses a restaurant the server can’t verify', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), searchVenues: () => page([candidate('p-1', 'Dishoom')]), confirmVenue: () => ok({ ...confirmed, available: false }) });
    renderWithProviders(<Harness />, stub.fetch);
    await userEvent.click(screen.getByRole('button', { name: /Choose a restaurant/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Dishoom/ }));
    await userEvent.click(screen.getByRole('button', { name: /Use Dishoom/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('This restaurant can’t be verified right now. Choose another.');
  });

  it('marks a venue whose display data is unavailable', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()) });
    renderWithProviders(<VenuePicker value={{ ...confirmed, available: false, name: null, address: null }} onConfirm={() => {}} />, stub.fetch);
    expect(screen.getByText('Restaurant information temporarily unavailable')).toBeTruthy();
  });
});
