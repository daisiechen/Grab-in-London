import Constants from 'expo-constants';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { DEFAULT_LEGAL_BASE_URL, legalBaseUrl } from '../config.ts';
import { LEGAL_PAGES, legalPageUrl, openLegalPage } from './legal.ts';

jest.mock('expo-web-browser', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use ESM imports
  ...require('../test/web-browser.ts').webBrowserMock(),
}));

// Constants.expoConfig is a non-configurable getter in jest-expo; give this file a plain config object.
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));

const extra = () => (Constants.expoConfig as unknown as { extra: Record<string, unknown> }).extra;
function withLegalBase(value: string) {
  extra().legalBaseUrl = value;
}

describe('legal page links', () => {
  afterEach(() => {
    delete extra().legalBaseUrl;
    jest.restoreAllMocks();
  });

  it('uses the Fancy site from app config for each App Store page', () => {
    expect(DEFAULT_LEGAL_BASE_URL).toBe('https://fancyabite.uk');
    expect(legalBaseUrl()).toBe('https://fancyabite.uk');
    expect(Object.keys(LEGAL_PAGES).map((page) => legalPageUrl(page as keyof typeof LEGAL_PAGES))).toEqual([
      'https://fancyabite.uk/privacy',
      'https://fancyabite.uk/terms',
      'https://fancyabite.uk/guidelines',
      'https://fancyabite.uk/support',
    ]);
  });

  it('honours a configured base URL without doubling slashes, and falls back when it is empty', () => {
    withLegalBase('http://127.0.0.1:5174/');
    expect(legalPageUrl('terms')).toBe('http://127.0.0.1:5174/terms');
    withLegalBase('');
    expect(legalPageUrl('terms')).toBe('https://fancyabite.uk/terms');
  });

  it('opens the in-app browser, and the system browser if that cannot be shown', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openLegalPage('privacy');
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith('https://fancyabite.uk/privacy', expect.objectContaining({ presentationStyle: 'pageSheet' }));
    expect(open).not.toHaveBeenCalled();
    jest.mocked(WebBrowser.openBrowserAsync).mockRejectedValueOnce(new Error('no view controller'));
    await openLegalPage('support');
    expect(open).toHaveBeenCalledWith('https://fancyabite.uk/support');
    open.mockRejectedValueOnce(new Error('cannot open'));
    jest.mocked(WebBrowser.openBrowserAsync).mockRejectedValueOnce(new Error('no view controller'));
    await expect(openLegalPage('terms')).resolves.toBeUndefined();
  });
});
