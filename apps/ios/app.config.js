// This bundle-visible key must be restricted to the iOS bundle identifier and Maps SDK.
// It is separate from the private server Places key. Native SDK changes require a new build.

/**
 * Build variants. Development builds keep the placeholder identifier the existing dev client is
 * signed with; only `APP_VARIANT=production` switches to the proposed App Store identifier on the
 * owner's domain. Changing the production id also needs the external changes listed in
 * docs/delivery/app-store-submission.zh-CN.md (Apple App ID, Google iOS key restriction, Auth0).
 */
const VARIANTS = {
  development: { bundleIdentifier: 'com.example.fancy.dev' },
  production: { bundleIdentifier: 'uk.fancyabite.app' },
};

/** Public site that serves the legal pages (/privacy, /terms, /guidelines, /support). */
const DEFAULT_LEGAL_BASE_URL = 'https://fancyabite.uk';

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT === 'production' ? 'production' : 'development';
  return {
    ...config,
    ios: { ...(config.ios ?? {}), bundleIdentifier: VARIANTS[variant].bundleIdentifier },
    extra: {
      ...(config.extra ?? {}),
      appVariant: variant,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || config.extra?.apiBaseUrl || 'http://localhost:3000',
      legalBaseUrl: process.env.EXPO_PUBLIC_LEGAL_BASE_URL || config.extra?.legalBaseUrl || DEFAULT_LEGAL_BASE_URL,
    },
    plugins: [...(config.plugins ?? []), ['react-native-maps', {
      iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY ?? '',
    }]],
  };
};
