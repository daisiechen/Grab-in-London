import { sandboxInstallMarker } from './install-marker.ts';

// Only the native filesystem boundary is substituted; marker + restore decisions use real code.
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { document: 'file://sandbox/' } }));

describe('sandbox install marker', () => {
  it('is absent on a fresh install, survives a restart, and is absent in a new sandbox', async () => {
    const file = { exists: false, write(_value: string) { this.exists = true; } };
    await expect(sandboxInstallMarker(file).isPresent()).resolves.toBe(false);
    await sandboxInstallMarker(file).set();
    await expect(sandboxInstallMarker(file).isPresent()).resolves.toBe(true);
    await expect(sandboxInstallMarker({ exists: false, write() {} }).isPresent()).resolves.toBe(false);
  });

  it('propagates disk failure so restore cannot trust an unmarked install', async () => {
    const marker = sandboxInstallMarker({ exists: false, write() { throw new Error('disk full'); } });
    await expect(marker.set()).rejects.toThrow('disk full');
  });
});
