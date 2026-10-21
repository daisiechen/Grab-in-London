import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { createFetchStub, fail, ok } from '../../test/fetchStub.ts';
import { renderApp } from '../../test/render.tsx';
import { HOST_ID, me, publicProfile, session } from '../../test/fixtures.ts';
import { loadDraft, saveDraft } from '../../lib/drafts.ts';

const gateIncomplete = {
  displayName: 'Sam Rivera', bio: null, lifeStatus: null, languages: [], interests: [],
  ageConfirmedVersion: null, communityAcceptedVersion: null,
  profileGate: { ageConfirmed: false, communityAccepted: false, profileComplete: false, missing: ['bio', 'languages', 'lifeStatus', 'interests', 'age', 'community'] },
};

function gateStub() {
  let current = me(gateIncomplete);
  const stub = createFetchStub({
    getSession: () => ok({ ...session(), user: current }),
    getMe: () => ok(current),
    updateMe: (call) => {
      current = me({ ...(call.body as object), version: '4' });
      return ok(current);
    },
  });
  return stub;
}

async function fillRequired() {
  await userEvent.type(await screen.findByLabelText(/A little about you/), 'I moved to London last spring and love food.');
  await userEvent.click(screen.getByLabelText('New to London'));
  await userEvent.click(screen.getByLabelText('English'));
  await userEvent.click(screen.getByLabelText('Food'));
}

describe('profile gate (T05)', () => {
  it('requires the 18+/community acknowledgement before any write', async () => {
    const stub = gateStub();
    renderApp(stub.fetch, '/profile/edit?returnTo=%2Fprofile');
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: /Take your seat/ }));
    expect((await screen.findByRole('alert')).textContent).toBe('Confirm the age and community acknowledgement to continue.');
    expect(stub.callsTo('updateMe')).toHaveLength(0);
  });

  it('saves with If-Match and consent versions, then returns without replaying the interrupted action', async () => {
    const stub = gateStub();
    saveDraft('apply:m1', { intro: 'Hello, I would love to join your table!' });
    renderApp(stub.fetch, '/profile/edit?returnTo=%2Fprofile');
    await fillRequired();
    await userEvent.click(screen.getByLabelText(/I’m 18 or older/));
    await userEvent.click(screen.getByRole('button', { name: /Take your seat/ }));
    await waitFor(() => expect(stub.callsTo('updateMe')).toHaveLength(1));
    const call = stub.callsTo('updateMe')[0]!;
    expect(call.headers['if-match']).toBe('"3"');
    expect(call.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(call.body).toMatchObject({
      displayName: 'Sam Rivera', lifeStatus: 'NEW_TO_LONDON', languages: ['en'], interests: ['FOOD'],
      ageConfirmedVersion: expect.any(String), communityAcceptedVersion: expect.any(String),
    });
    expect(call.body).not.toHaveProperty('email');
    expect(await screen.findByRole('heading', { name: 'Sam Rivera' })).toBeTruthy();
    // The other flow's draft survives the detour; it is restored there, not submitted here.
    expect(loadDraft('apply:m1')).toEqual({ intro: 'Hello, I would love to join your table!' });
    expect(stub.calls.map((c) => c.operationId)).not.toContain('applyMeal');
  });

  it('on VERSION_CONFLICT reloads the profile and keeps the user’s edits', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      getMe: () => ok(me()),
      updateMe: () => fail(409, 'VERSION_CONFLICT', { currentVersion: '5' }),
    });
    renderApp(stub.fetch, '/profile/edit');
    const name = await screen.findByLabelText('Your name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Sam R');
    await userEvent.click(screen.getByRole('button', { name: /Save profile/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/updated elsewhere/);
    expect(stub.callsTo('getMe').length).toBeGreaterThanOrEqual(2);
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Sam R');
  });

  it('maps server field errors onto fields', async () => {
    const stub = createFetchStub({
      getSession: () => ok(session()),
      getMe: () => ok(me()),
      updateMe: () => fail(422, 'VALIDATION_FAILED', { fieldErrors: { displayName: 'Name is not allowed.' } }),
    });
    renderApp(stub.fetch, '/profile/edit');
    await userEvent.click(await screen.findByRole('button', { name: /Save profile/ }));
    expect(await screen.findByText('Name is not allowed.')).toBeTruthy();
  });

  it('sends a guest to sign-in with the edit page as return target', async () => {
    const stub = createFetchStub({ getSession: () => fail(401, 'AUTH_REQUIRED') });
    renderApp(stub.fetch, '/profile/edit');
    expect(await screen.findByRole('heading', { name: 'Let’s keep in touch.' })).toBeTruthy();
  });
});

describe('public profile (T05)', () => {
  it('renders the public projection for guests with published references only', async () => {
    const stub = createFetchStub({
      getSession: () => fail(401, 'AUTH_REQUIRED'),
      getPublicProfile: () => ok({
        profile: publicProfile(),
        reviews: [{ id: '77777777-7777-4777-8777-777777777777', mealId: '33333333-3333-4333-8333-333333333333', author: publicProfile('88888888-8888-4888-8888-888888888888', 'Emma Hill'), body: 'Made everyone feel included.', publishedAt: '2026-10-01T10:00:00.000Z' }],
        nextReviewCursor: null,
      }),
    });
    renderApp(stub.fetch, `/profiles/${HOST_ID}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Maya Chen' })).toBeTruthy();
    expect(screen.getByText(/Made everyone feel included/)).toBeTruthy();
    expect(screen.getByText('English & Chinese', { exact: false })).toBeTruthy();
    expect(stub.callsTo('getPublicProfile')[0]!.params.userId).toBe(HOST_ID);
  });
});
