/**
 * Shared expo-router double. Use in a test file with:
 *   jest.mock('expo-router', () => require('<rel>/test/router.ts').expoRouterMock);
 */
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
  canDismiss: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  navigate: jest.fn(),
};

export const routeParams: { current: Record<string, string> } = { current: {} };

export const expoRouterMock = {
  useRouter: () => mockRouter,
  useLocalSearchParams: () => routeParams.current,
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react') as typeof import('react');
    useEffect(() => cb(), [cb]);
  },
  Redirect: () => null,
  Stack: { Screen: () => null },
  Link: ({ children }: { children: unknown }) => children,
};

export function resetRouter() {
  for (const fn of Object.values(mockRouter)) fn.mockClear();
  mockRouter.canGoBack.mockImplementation(() => true);
  mockRouter.canDismiss.mockImplementation(() => true);
  routeParams.current = {};
}
