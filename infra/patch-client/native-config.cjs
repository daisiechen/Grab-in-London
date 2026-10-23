/** Build-only variant; must never replace the sealed app's bundle or callback scheme. */
module.exports = function patchNativeConfig(config, env) {
 if (env.FANCY_APP_VARIANT !== 'patch-p11') return config;
 if (env.EXPO_PUBLIC_API_BASE_URL !== 'http://127.0.0.1:64176') throw new Error('PATCH_NATIVE_API_REQUIRED');
 const ios={...config.ios,bundleIdentifier:'uk.fancyabite.patch.p11'};
 if(env.EXPO_PUBLIC_MEAL_ORIGIN){
  const origin=new URL(env.EXPO_PUBLIC_MEAL_ORIGIN);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.port||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('PATCH_PUBLIC_MEAL_ORIGIN_REQUIRED');
  ios.associatedDomains=[`applinks:${origin.hostname}`];
 }
 return {...config,name:'Fancy P1.1 Test',slug:'fancy-p11-test',scheme:'fancyp11',ios,extra:{...config.extra,patchVersion:'P1.1'}};
};
