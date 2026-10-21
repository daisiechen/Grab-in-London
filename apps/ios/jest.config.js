// jest-expo iOS preset. Test files are *.test.ts(x) so the root vitest "unit" project
// (apps/**/*.unit.test.ts) never picks up React Native tests.
// transformIgnorePatterns follows Expo's pnpm guidance: real paths live under node_modules/.pnpm/<pkg>@<ver>/.
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/{app,src}/**/*.test.{ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/)?(?:(?:jest-)?react-native|@react-native(?:-community)?|expo(?:nent)?|@expo(?:nent)?|@expo-google-fonts|react-navigation|@react-navigation))',
  ],
  setupFilesAfterEnv:['<rootDir>/src/test/native-maps.ts'],
  clearMocks: true,
};
