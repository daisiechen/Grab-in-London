import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { legalBaseUrl } from '../config.ts';

/** Public pages the App Store and members need: served by the web build at fancyabite.uk. */
export const LEGAL_PAGES = {
  privacy: { path: '/privacy', label: 'Privacy notice' },
  terms: { path: '/terms', label: 'Terms of use' },
  guidelines: { path: '/guidelines', label: 'Community guidelines' },
  support: { path: '/support', label: 'Contact support' },
} as const;

export type LegalPage = keyof typeof LEGAL_PAGES;

export function legalPageUrl(page: LegalPage): string {
  return `${legalBaseUrl()}${LEGAL_PAGES[page].path}`;
}

/**
 * Opens a legal page in the in-app Safari view (reader keeps the app's context); falls back to the
 * system browser if the view can't be presented. Failures are swallowed: the page is informational
 * and the Settings row stays usable.
 */
export async function openLegalPage(page: LegalPage): Promise<void> {
  const url = legalPageUrl(page);
  try {
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  } catch {
    await Linking.openURL(url).catch(() => {});
  }
}
