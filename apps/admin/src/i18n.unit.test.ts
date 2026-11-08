import { describe, expect, it } from 'vitest';
import { versionLabel } from './i18n.ts';

describe('definition version label', () => {
  it('shows the server value (v4) once and prefixes a bare number', () => {
    expect(versionLabel('v4')).toBe('v4');
    expect(versionLabel('4')).toBe('v4');
  });
});
