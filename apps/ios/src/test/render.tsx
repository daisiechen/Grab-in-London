import {memoryDeletionReceiptStore,type DeletionReceiptStore} from '../features/settings/deletion-receipt-store.ts';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Node SHA256 only in isolated test helpers
const {createHash}=require('node:crypto') as {createHash(algorithm:string):{update(value:string):{digest(format:string):string}}};
import {memoryAIConversationStore,type AIConversationStore} from '../features/assistant/session-store.ts';
import {memoryGuestCredentialStore,type GuestCredentialStore} from '../features/assistant/guest-store.ts';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WebBrowserResultType, type WebBrowserAuthSessionResult } from 'expo-web-browser';
import { ServicesProvider, createServices, type Services } from '../services.tsx';
import { createMockFetch, ok, type MockFetch } from './mock-fetch.ts';
import { NOW, credentials, memoryStore, seqId, sessionInfo, HANDOFF } from './fixtures.ts';
import type { Me } from '../features/auth/session.ts';

const metrics = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, left: 0, right: 0, bottom: 34 } };

export interface TestApp {
  services: Services;
  mock: MockFetch;
  store: ReturnType<typeof memoryStore>;
  openAuthSession: jest.Mock<Promise<WebBrowserAuthSessionResult>, [string, string]>;
}

export function createTestApp(opts: { deletionReceiptStore?:DeletionReceiptStore;now?: () => number;guestStore?:GuestCredentialStore;aiConversationStore?:AIConversationStore;installMarker?:import('../features/auth/credential-store.ts').InstallMarker } = {}): TestApp {
  const mock = createMockFetch();
  const store = memoryStore();
  const openAuthSession = jest.fn<Promise<WebBrowserAuthSessionResult>, [string, string]>(async () => ({ type: WebBrowserResultType.CANCEL }));
  const services = createServices({
    baseUrl: 'http://api.test',
    deletionReceiptStore:opts.deletionReceiptStore??memoryDeletionReceiptStore(),
    fetch: mock.fetch,
    store,guestStore:opts.guestStore??memoryGuestCredentialStore(),aiConversationStore:opts.aiConversationStore??memoryAIConversationStore(),hashGuestCredential:async token=>createHash('sha256').update(token).digest('hex'),
    installMarker: opts.installMarker??null,
    openAuthSession,
    createChallenge: async () => ({ verifier: 'V'.repeat(43), challenge: 'C'.repeat(43) }),
    newId: seqId,
    now: opts.now ?? (() => NOW),
    randomBytes: (n) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256),
  });
  return { services, mock, store, openAuthSession };
}

/** Signs the test app in through the real handoff path with the given user. */
export async function signIn(app: TestApp, user?: Me) {
  app.mock.on('POST', '/v1/auth/handoff', ok(credentials()), 1);
  app.mock.on('GET', '/v1/auth/session', ok(sessionInfo(user)), 1);
  await app.services.session.completeHandoff(HANDOFF, 'V'.repeat(43));
}

export async function renderApp(app: TestApp, ui: ReactElement) {
  return await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ServicesProvider services={app.services}>{ui}</ServicesProvider>
    </SafeAreaProvider>,
  );
}
