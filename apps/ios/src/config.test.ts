// Expo loads its dynamic app config as CommonJS; exercise that same entry point.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const configure = require('../app.config.js');
/** Jest's CommonJS module scope (React Native's types don't declare Node globals). */
declare const __dirname: string;

describe('native API bundle configuration', () => {
  const original = process.env.EXPO_PUBLIC_API_BASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = original;
  });
  test('explicit local fixture API overrides the default without losing extra config', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:61973';
    const result = configure({config:{extra:{apiBaseUrl:'http://localhost:3000',keep:true},plugins:['expo-router']}});
    expect(result.extra).toEqual({apiBaseUrl:'http://127.0.0.1:61973',keep:true,appVariant:'development',legalBaseUrl:'https://fancyabite.uk'});
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

describe('build variants and legal site', () => {
  const saved = { variant: process.env.APP_VARIANT, legal: process.env.EXPO_PUBLIC_LEGAL_BASE_URL };
  afterEach(() => {
    for (const [key, value] of [['APP_VARIANT', saved.variant], ['EXPO_PUBLIC_LEGAL_BASE_URL', saved.legal]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const appJson = require('../app.json') as {expo:{ios:{bundleIdentifier:string};icon:string;extra:{legalBaseUrl:string}}};

  test('development builds keep the placeholder id the dev client is signed with', () => {
    delete process.env.APP_VARIANT;
    const result = configure({config:appJson.expo});
    expect(result.ios.bundleIdentifier).toBe('com.example.fancy.dev');
    expect(result.ios.bundleIdentifier).toBe(appJson.expo.ios.bundleIdentifier);
    expect(result.extra.appVariant).toBe('development');
    expect(result.ios.supportsTablet).toBe(false);
  });

  test('only APP_VARIANT=production switches to the App Store id on the owner domain', () => {
    process.env.APP_VARIANT = 'production';
    const result = configure({config:appJson.expo});
    expect(result.ios.bundleIdentifier).toBe('uk.fancyabite.app');
    expect(result.extra.appVariant).toBe('production');
    expect(result.ios.config).toEqual({usesNonExemptEncryption:false});
    process.env.APP_VARIANT = 'staging';
    expect(configure({config:appJson.expo}).ios.bundleIdentifier).toBe('com.example.fancy.dev');
  });

  test('legal pages default to fancyabite.uk and can be pointed at a local web build', () => {
    delete process.env.EXPO_PUBLIC_LEGAL_BASE_URL;
    expect(configure({config:appJson.expo}).extra.legalBaseUrl).toBe('https://fancyabite.uk');
    expect(configure({config:{}}).extra.legalBaseUrl).toBe('https://fancyabite.uk');
    process.env.EXPO_PUBLIC_LEGAL_BASE_URL = 'http://127.0.0.1:5174';
    expect(configure({config:appJson.expo}).extra.legalBaseUrl).toBe('http://127.0.0.1:5174');
  });

  test('the app icon is the opaque 1024px square PNG', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {readFileSync}=require('node:fs') as {readFileSync(path:string):Uint8Array};
    expect(appJson.expo.icon).toBe('./assets/images/icon.png');
    const png = readFileSync(`${__dirname}/../assets/images/icon.png`);
    expect(Array.from(png.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1024, 1024]);
    expect(png[25]).toBe(2); // colour type 2 = truecolour without alpha
  });
});
