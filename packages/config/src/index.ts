/**
 * Runtime configuration guard shared by the API, worker and CLIs.
 * Test-only adapters (test identity, fixture places, outbox-only mail, mock AI,
 * fixed OTP) are allowed only for development/test against a local database;
 * staging and production refuse to start with them.
 */

export const ENVIRONMENTS = ['development', 'test', 'staging', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const ADAPTERS = {
  AUTH_ADAPTER: ['auth0', 'test'],
  PLACES_ADAPTER: ['google', 'fixture'],
  MAIL_ADAPTER: ['provider', 'outbox_test'],
  AI_PROVIDER: ['deepseek', 'mock', 'disabled'],
} as const;
type AdapterKey = keyof typeof ADAPTERS;

const TEST_ONLY_ADAPTER: Record<AdapterKey, string> = {
  AUTH_ADAPTER: 'test',
  PLACES_ADAPTER: 'fixture',
  MAIL_ADAPTER: 'outbox_test',
  AI_PROVIDER: 'mock',
};

/** Every key the guard reads; .env.example must list exactly these names. */
export const CONFIG_KEYS = [
  'ENVIRONMENT',
  'DATABASE_URL',
  ...(Object.keys(ADAPTERS) as AdapterKey[]),
  'DEV_FIXED_OTP',
  'WEB_ORIGIN',
  'PRIVACY_POLICY_VERSION',
  'RETENTION_POLICY_JSON',
  'LOG_LEVEL',
] as const;

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

export interface CoreConfig {
  environment: Environment;
  databaseUrl: string;
  adapters: { [K in AdapterKey]: (typeof ADAPTERS)[K][number] };
  devFixedOtp: string | null;
  webOrigin: string | null;
  privacyPolicyVersion: string | null;
  retentionPolicy: Record<string, unknown> | null;
  logLevel: LogLevel;
}

/** Lists offending keys only; values are never echoed so secrets stay out of logs. */
export class ConfigError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super('Invalid configuration: ' + issues.join('; '));
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function parseDatabaseUrl(raw: string | undefined, issues: string[]): URL | null {
  if (!raw) {
    issues.push('DATABASE_URL is required');
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      issues.push('DATABASE_URL must be a postgres:// URL');
      return null;
    }
    return url;
  } catch {
    issues.push('DATABASE_URL is not a valid URL');
    return null;
  }
}

export function loadConfig(env: Readonly<Record<string, string | undefined>>): CoreConfig {
  const issues: string[] = [];
  const value = (key: string) => {
    const v = env[key]?.trim();
    return v ? v : undefined;
  };

  const environment = value('ENVIRONMENT') as Environment | undefined;
  if (!environment || !ENVIRONMENTS.includes(environment)) {
    throw new ConfigError([`ENVIRONMENT must be one of ${ENVIRONMENTS.join('/')}`]);
  }
  const deployed = environment === 'staging' || environment === 'production';
  const db = parseDatabaseUrl(value('DATABASE_URL'), issues);

  const adapters = {} as Record<AdapterKey, string>;
  for (const key of Object.keys(ADAPTERS) as AdapterKey[]) {
    const chosen = value(key);
    const allowed: readonly string[] = ADAPTERS[key];
    if (!chosen || !allowed.includes(chosen)) {
      issues.push(`${key} must be one of ${allowed.join('/')}`);
      continue;
    }
    adapters[key] = chosen;
    if (chosen === TEST_ONLY_ADAPTER[key]) {
      if (deployed) issues.push(`${key}=${chosen} is test-only and refused in ${environment}`);
      else if (db && !LOCAL_HOSTS.has(db.hostname)) {
        issues.push(`${key}=${chosen} requires an isolated local DATABASE_URL`);
      }
    }
  }

  const devFixedOtp = value('DEV_FIXED_OTP') ?? null;
  if (devFixedOtp && deployed) issues.push(`DEV_FIXED_OTP must be unset in ${environment}`);

  const webOrigin = value('WEB_ORIGIN') ?? null;
  const privacyPolicyVersion = value('PRIVACY_POLICY_VERSION') ?? null;
  let retentionPolicy: Record<string, unknown> | null = null;
  const retentionRaw = value('RETENTION_POLICY_JSON');
  if (retentionRaw) {
    try {
      const parsed: unknown = JSON.parse(retentionRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        retentionPolicy = parsed as Record<string, unknown>;
      } else issues.push('RETENTION_POLICY_JSON must be a JSON object');
    } catch {
      issues.push('RETENTION_POLICY_JSON is not valid JSON');
    }
  }

  if (deployed) {
    const sslmode = db?.searchParams.get('sslmode');
    if (db && sslmode !== 'require' && sslmode !== 'verify-full' && sslmode !== 'verify-ca') {
      issues.push(`DATABASE_URL must enable TLS (sslmode=require|verify-ca|verify-full) in ${environment}`);
    }
    if (!webOrigin || !webOrigin.startsWith('https://')) issues.push(`WEB_ORIGIN must be an https origin in ${environment}`);
    if (!privacyPolicyVersion) issues.push(`PRIVACY_POLICY_VERSION is required in ${environment}`);
    if (!retentionPolicy) issues.push(`RETENTION_POLICY_JSON approved under G-PRIVACY is required in ${environment}`);
  }

  const logLevel = (value('LOG_LEVEL') ?? 'info') as LogLevel;
  if (!LOG_LEVELS.includes(logLevel)) issues.push(`LOG_LEVEL must be one of ${LOG_LEVELS.join('/')}`);

  if (issues.length) throw new ConfigError(issues);
  return {
    environment,
    databaseUrl: db!.toString(),
    adapters: adapters as CoreConfig['adapters'],
    devFixedOtp,
    webOrigin,
    privacyPolicyVersion,
    retentionPolicy,
    logLevel,
  };
}
