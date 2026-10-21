import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  try {
    sessionStorage.clear();
  } catch {
    /* jsdom always has storage; guard mirrors production code */
  }
});
