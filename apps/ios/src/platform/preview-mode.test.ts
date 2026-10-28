import { isPreviewMode, usesMemoryStores } from './preview-mode.ts';

describe('preview mode switch', () => {
  it('is on for the web build by default and opt-in on device', () => {
    expect(isPreviewMode(undefined, 'web')).toBe(true);
    expect(isPreviewMode(undefined, 'ios')).toBe(false);
    expect(isPreviewMode('1', 'ios')).toBe(true);
  });

  it('EXPO_PUBLIC_FANCY_PREVIEW=0 lets the web build use the real API', () => {
    expect(isPreviewMode('0', 'web')).toBe(false);
    expect(isPreviewMode('0', 'ios')).toBe(false);
  });

  it('keeps credentials in memory wherever there is no Keychain', () => {
    expect(usesMemoryStores(false, 'web')).toBe(true);
    expect(usesMemoryStores(true, 'ios')).toBe(true);
    expect(usesMemoryStores(false, 'ios')).toBe(false);
  });
});
