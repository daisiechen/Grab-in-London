// Deploy/startup preflight: `node packages/config/src/check-env.ts` exits 1 on invalid config.
import { ConfigError, loadConfig } from './index.ts';

try {
  const config = loadConfig(process.env);
  console.warn(`configuration ok for ${config.environment}`);
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}
