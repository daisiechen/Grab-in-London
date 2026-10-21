import { File, Paths } from 'expo-file-system';
import type { InstallMarker } from '../features/auth/credential-store.ts';

interface MarkerFile {
  readonly exists: boolean;
  write(value: string): void;
}

/** App-sandbox state, deliberately separate from Keychain (which can survive uninstall). */
export function sandboxInstallMarker(file: MarkerFile = new File(Paths.document, '.fancy-install-v1')): InstallMarker {
  return {
    async isPresent() {
      return file.exists;
    },
    async set() {
      file.write('1');
    },
  };
}
