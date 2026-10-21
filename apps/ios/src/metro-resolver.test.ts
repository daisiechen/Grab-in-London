jest.mock('expo/metro-config', () => ({getDefaultConfig: () => ({resolver:{}, fixtureDefault:true})}));
// Expo consumes this config through CommonJS; exercise its actual entry point.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('../metro.config.js');

describe('native schema package resolution', () => {
  test.each(['@sinclair/typebox', '@sinclair/typebox/value', '@sinclair/typebox/compiler'])(
    '%s uses the official CommonJS export before Metro transforms it', (name) => {
      const resolved = {type:'sourceFile',filePath:'/fixture/typebox/build/cjs/index.js'};
      const resolveRequest = jest.fn(() => resolved);
      const context = {resolveRequest,isESMImport:true,unstable_conditionNames:['import','react-native'],fixture:'preserve'};
      expect(config.resolver.resolveRequest(context,name,'ios')).toBe(resolved);
      expect(resolveRequest).toHaveBeenCalledWith({...context,isESMImport:false,unstable_conditionNames:['require']},name,'ios');
      expect(context.isESMImport).toBe(true);
      expect(context.unstable_conditionNames).toEqual(['import','react-native']);
    },
  );
  test.each(['react', '@sinclair/typebox-extra', '@fancy/contracts'])(
    '%s preserves the original resolver context', (name) => {
      const resolveRequest = jest.fn(() => ({type:'sourceFile',filePath:'/fixture/original.js'}));
      const context = {resolveRequest,isESMImport:true,unstable_conditionNames:['import']};
      config.resolver.resolveRequest(context,name,'ios');
      expect(resolveRequest).toHaveBeenCalledWith(context,name,'ios');
    },
  );
  test('preserves Expo defaults', () => expect(config.fixtureDefault).toBe(true));
});
