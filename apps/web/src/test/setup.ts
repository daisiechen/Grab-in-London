import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clearFreshSignIn } from '../lib/freshSignIn.ts';

// Route pages are lazily loaded chunks (app/routes.tsx). Load them before each test so pages render
// synchronously as before; imported here, after the test file registered its vi.mock()s, so mocked
// modules are the ones the pages use. app/lazyPage.unit.test.tsx covers the loading state itself.
beforeEach(async () => {
  const { preloadAllPages } = await import('../app/routes.tsx');
  await preloadAllPages();
});

afterEach(() => {
  cleanup();
  clearFreshSignIn();
  try {
    sessionStorage.clear();
  } catch {
    /* jsdom always has storage; guard mirrors production code */
  }
});
