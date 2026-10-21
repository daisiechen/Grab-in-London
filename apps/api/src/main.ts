import {productionAssistantBundle} from './assistant/production-bundle.ts';
// API process entry: `node apps/api/src/main.ts` with configuration from the environment.
import { ConfigError, loadConfig, type CoreConfig } from '@fancy/config';
import { createPool } from '@fancy/db';
import { buildServer } from './http/server.ts';
import { Auth0IdentityProvider } from './identity/auth0-provider.ts';
import { TestIdentityProvider } from './identity/test-provider.ts';
import type { IdentityProvider } from './identity/provider.ts';
import { GooglePlacesProvider } from './venues/google-provider.ts';

export function identityProviderFor(config: CoreConfig): IdentityProvider {
  if (config.adapters.AUTH_ADAPTER === 'test') return new TestIdentityProvider(config.environment);
  return new Auth0IdentityProvider(config.auth0!);
}

if (import.meta.main) {
  let config: CoreConfig;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
  const pool = createPool(config.databaseUrl, { application: 'fancy-api' });
  const assistant=await productionAssistantBundle({bundleFile:config.aiBundleFile,apiKey:config.deepseekApiKey,provider:config.adapters.AI_PROVIDER});
  const app = await buildServer({ config, pool, identity: identityProviderFor(config), publicOrigin: config.webOrigin, ...(assistant?{assistant}:{}),
    ...(config.adapters.PLACES_ADAPTER === 'google' && config.googleMapsApiKey ? { placesProvider: new GooglePlacesProvider(config.googleMapsApiKey) } : {}) });
  await app.listen({ port: config.port, host: '127.0.0.1' });
}
