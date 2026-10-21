import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { createFetchStub, fail } from '../test/fetchStub.ts';
import { renderApp } from '../test/render.tsx';

describe('App shell', () => {
  it('renders the bottom navigation with the prototype tabs and an unknown-route page', async () => {
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED') });
    renderApp(stub.fetch, '/no-such-page');
    expect(await screen.findByRole('heading', { name: 'This page isn’t on the menu.' })).toBeTruthy();
    await waitFor(() => expect(stub.callsTo('getSession')).toHaveLength(1));
  });
});
