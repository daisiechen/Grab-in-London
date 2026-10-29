import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { clearFreshSignIn } from '../lib/freshSignIn.ts';

afterEach(() => {
  cleanup();
  clearFreshSignIn();
  try {
    sessionStorage.clear();
  } catch {
    /* jsdom always has storage; guard mirrors production code */
  }
});
