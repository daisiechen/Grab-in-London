// Expo loads its dynamic app config as CommonJS; exercise that same entry point.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const configure = require('../app.config.js');

describe('native API bundle configuration', () => {
  const original = process.env.EXPO_PUBLIC_API_BASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = original;
  });
  test('explicit local fixture API overrides the default without losing extra config', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:61973';
    const result = configure({config:{extra:{apiBaseUrl:'http://localhost:3000',keep:true},plugins:['expo-router']}});
    expect(result.extra).toEqual({apiBaseUrl:'http://127.0.0.1:61973',keep:true});
    expect(result.plugins[0]).toBe('expo-router');
  });
  test('unset or empty override preserves the established default', () => {
    for (const value of [undefined, '']) {
      if (value === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
      else process.env.EXPO_PUBLIC_API_BASE_URL=value;
      expect(configure({config:{extra:{apiBaseUrl:'http://localhost:3000'}}}).extra.apiBaseUrl).toBe('http://localhost:3000');
    }
  });
});
