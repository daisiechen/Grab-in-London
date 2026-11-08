/**
 * expo-web-browser for tests: the real module (enums, auth-session types) with openBrowserAsync
 * replaced by a resolved mock, so legal-page links can be asserted without a native view.
 * Use inside jest.mock('expo-web-browser', () => require('…/test/web-browser.ts').webBrowserMock()).
 */
export function webBrowserMock() {
  const actual = jest.requireActual<typeof import('expo-web-browser')>('expo-web-browser');
  return { ...actual, openBrowserAsync: jest.fn(async () => ({ type: actual.WebBrowserResultType.OPENED })) };
}
