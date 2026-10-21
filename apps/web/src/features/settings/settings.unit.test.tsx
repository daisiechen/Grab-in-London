import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render.tsx';
import { createFetchStub, fail, ok } from '../../test/fetchStub.ts';
import { session } from '../../test/fixtures.ts';

const initial = { version: '0', again: null, reasons: [], submittedAt: null };
describe('product survey', () => {
  it('rejects an empty survey and saves factors independently of again, with revision and intent', async () => {
    const stub = createFetchStub({ getSession: () => ok(session()), getSurvey: () => ok(initial), putSurvey: c => ok({ ...c.body as object, version: '1', submittedAt: '2026-10-21T12:00:00Z' }) });
    renderApp(stub.fetch, '/settings/survey');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Save feedback' }));
    expect(await screen.findByText('Choose an answer or at least one factor.')).toBeTruthy();
    expect(stub.callsTo('putSurvey')).toHaveLength(0);
    await user.click(screen.getByRole('checkbox', { name: 'The cost' }));
    await user.click(screen.getByRole('button', { name: 'Save feedback' }));
    expect(await screen.findByText('Your feedback is saved.')).toBeTruthy();
    const call = stub.callsTo('putSurvey')[0]!;
    expect(call.body).toEqual({ again: null, reasons: ['cost'] });
    expect(call.headers['if-match']).toBe('"0"');
    expect(call.headers['idempotency-key']).toBeTruthy();
  });
  it('preserves local answers after a revision conflict and retries with the current version', async () => {
    let attempts = 0;
    const stub = createFetchStub({ getSession: () => ok(session()), getSurvey: () => ok(initial), putSurvey: c => ++attempts === 1 ? fail(409, 'VERSION_CONFLICT', { currentVersion: '4' }) : ok({ ...c.body as object, version: '5', submittedAt: null }) });
    renderApp(stub.fetch, '/settings/survey');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Save feedback' }));
    await waitFor(() => expect(stub.callsTo('putSurvey')).toHaveLength(1));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save feedback' }) as HTMLButtonElement).disabled).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Save feedback' }));
    await screen.findByText('Your feedback is saved.');
    expect(stub.callsTo('putSurvey')[1]!.body).toEqual({ again: true, reasons: [] });
    expect(stub.callsTo('putSurvey')[1]!.headers['if-match']).toBe('"4"');
  });
});
