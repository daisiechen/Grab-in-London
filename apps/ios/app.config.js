// This bundle-visible key must be restricted to the iOS bundle identifier and Maps SDK.
// It is separate from the private server Places key. Native SDK changes require a new build.
module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins ?? []), ['react-native-maps', {
    iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY ?? '',
  }]],
});
