import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok, page } from '../../test/fetchStub.ts';
import { renderWithProviders } from '../../test/render.tsx';
import { VENUE_REF, session } from '../../test/fixtures.ts';
import type { Venue } from '../../api/types.ts';
import { VenuePicker } from './VenuePicker.tsx';

const candidate = (placeId: string, name: string) => ({ placeId, name, address: `${name} St, London`, photoRefs: [], attributions: [{ provider: 'google', text: 'Powered by Google' }] });
const confirmed: Venue = { venueRef: VENUE_REF, placeId: 'p-1', available: true, name: 'Dishoom (confirmed)', address: '22 Kingly St, London W1B 5QP', location: null, areaCode: 'soho', attributions: [], displayExpiresAt: null };

function Harness() {
  const [venue, setVenue] = useState<Venue | null>(null);
  return <VenuePicker value={venue} onConfirm={setVenue} />;
}

describe('VenuePicker (T06)', () => {
  it('confirms by placeId only and shows the server-confirmed details', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      searchVenues: () => page([candidate('p-1', 'Dishoom'), candidate('p-2', 'Barrafina')]),
      confirmVenue: () => ok(confirmed),
    });
    renderWithProviders(<Harness />, stub.fetch);
    await userEvent.type(screen.getByLabelText('Search restaurants'), 'dish');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(stub.callsTo('searchVenues')[0]!.url.searchParams.get('q')).toBe('dish');
    expect(await screen.findByText('Powered by Google')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Dishoom/ }));
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
    await userEvent.type(screen.getByLabelText('Search restaurants'), 'dish');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    await userEvent.click(await screen.findByRole('button', { name: /Dishoom/ }));
    await userEvent.click(screen.getByRole('button', { name: /Use Dishoom/ }));
    await screen.findByText('Dishoom (confirmed)');
    stub.on('searchVenues', () => page([]));
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No restaurants found. Try another name.')).toBeTruthy();
    expect(screen.getByText('Dishoom (confirmed)')).toBeTruthy();
    expect(screen.queryByLabelText(/address/i)).toBeNull();
  });

  it('reports provider outages without a fallback', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), searchVenues: () => fail(503, 'PROVIDER_UNAVAILABLE') });
    renderWithProviders(<Harness />, stub.fetch);
    await userEvent.type(screen.getByLabelText('Search restaurants'), 'dish');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Restaurant search is temporarily unavailable. Try again shortly.');
  });

  it('marks a venue whose display data is unavailable', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()) });
    renderWithProviders(<VenuePicker value={{ ...confirmed, available: false, name: null, address: null }} onConfirm={() => {}} />, stub.fetch);
    expect(screen.getByText('Restaurant information temporarily unavailable')).toBeTruthy();
  });
});
