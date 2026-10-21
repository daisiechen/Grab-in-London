const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// TypeBox's ESM Object export shadows the Object used by Metro's CommonJS shim.
// Its official CommonJS exports avoid that first-launch crash without changing schemas.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@sinclair/typebox' || moduleName.startsWith('@sinclair/typebox/')) {
    return context.resolveRequest({
      ...context,
      isESMImport: false,
      unstable_conditionNames: ['require'],
    }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
