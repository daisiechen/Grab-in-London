import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './index.ts';

const local = {
  ENVIRONMENT: 'test',
  DATABASE_URL: 'postgres://fancy@127.0.0.1:5432/fancy_test',
  AUTH_ADAPTER: 'test',
  PLACES_ADAPTER: 'fixture',
  MAIL_ADAPTER: 'outbox_test',
  AI_PROVIDER: 'mock',
  WEB_ORIGIN: 'http://localhost:5174',
  SESSION_SECRET: 'test-session-secret-0123456789abcdef',
};
const production = {
  ENVIRONMENT: 'production',
  DATABASE_URL: 'postgres://app:hunter2-secret@db.internal:5432/fancy?sslmode=verify-full',
  AUTH_ADAPTER: 'auth0',
  PLACES_ADAPTER: 'google',
  MAIL_ADAPTER: 'provider',
  AI_PROVIDER: 'deepseek',
  WEB_ORIGIN: 'https://app.example.test',
  SESSION_SECRET: 'prod-session-secret-0123456789abcdefgh',
  AUTH0_DOMAIN: 'tenant.eu.auth0.example',
  AUTH0_CLIENT_ID: 'client-id',
  AUTH0_CLIENT_SECRET: 'client-secret-value-for-tests',
  PRIVACY_POLICY_VERSION: '2026-10',
  RETENTION_POLICY_JSON: '{"deletedAccountDays":30}',
};

describe('trusted reverse proxies', () => {
  it('defaults to no forwarded-header trust and accepts only explicit address ranges', () => {
    expect(loadConfig(local).trustedProxyCidrs).toEqual([]);
    expect(loadConfig({ ...local, TRUSTED_PROXY_CIDRS: '127.0.0.1, ::1/128, 10.1.2.0/24,127.0.0.1' }).trustedProxyCidrs)
      .toEqual(['127.0.0.1', '::1/128', '10.1.2.0/24']);
  });
  it.each(['true', '*', 'loopback', 'localhost', '0.0.0.0/0', '::/0', '127.0.0.1/33', '::1/129', '127.0.0.1/', '127.0.0.1,,::1', 'fe80::1%en0'])('refuses unsafe or malformed trust value %s', (input) => {
    expect(() => loadConfig({ ...local, TRUSTED_PROXY_CIDRS: input })).toThrow(/TRUSTED_PROXY_CIDRS/);
  });
});

it('accepts a privately supplied DeepSeek credential without changing the selected adapter',()=>{
  expect(loadConfig(local).deepseekApiKey).toBeNull();
  const config=loadConfig({...local,DEEPSEEK_API_KEY:'local-placeholder-only'});
  expect(config.deepseekApiKey).toBe('local-placeholder-only');
  expect(config.adapters.AI_PROVIDER).toBe('mock');
});

it('keeps analytics partial until a valid historical deployment coverage instant is explicitly supplied',()=>{
  expect(loadConfig(local).analyticsCoverageStart).toBeNull();
  expect(loadConfig({...local,ANALYTICS_COVERAGE_START:'2020-01-01T00:00:00Z'}).analyticsCoverageStart).toBe('2020-01-01T00:00:00Z');
  expect(()=>loadConfig({...local,ANALYTICS_COVERAGE_START:'not-an-instant'})).toThrow(/ANALYTICS_COVERAGE_START/);
  expect(()=>loadConfig({...local,ANALYTICS_COVERAGE_START:new Date(Date.now()+86400_000).toISOString()})).toThrow(/ANALYTICS_COVERAGE_START/);
});

function issuesOf(env: Record<string, string>): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).issues;
  }
  throw new Error('expected configuration to be rejected');
}

describe('loadConfig', () => {
  it('accepts test-only adapters for the isolated local test environment', () => {
    const config = loadConfig(local);
    expect(config.adapters).toEqual({ AUTH_ADAPTER: 'test', PLACES_ADAPTER: 'fixture', MAIL_ADAPTER: 'outbox_test', AI_PROVIDER: 'mock' });
  });

  it('accepts a fully real production configuration', () => {
    expect(loadConfig(production).environment).toBe('production');
  });

  it.each([
    ['AUTH_ADAPTER', 'test'],
    ['PLACES_ADAPTER', 'fixture'],
    ['MAIL_ADAPTER', 'outbox_test'],
    ['AI_PROVIDER', 'mock'],
  ])('refuses %s=%s in production and staging', (key, fixture) => {
    for (const environment of ['production', 'staging']) {
      const issues = issuesOf({ ...production, ENVIRONMENT: environment, [key]: fixture });
      expect(issues).toEqual([`${key}=${fixture} is test-only and refused in ${environment}`]);
    }
  });

  it('refuses a fixed development OTP when deployed', () => {
    expect(issuesOf({ ...production, DEV_FIXED_OTP: '123456' })).toEqual(['DEV_FIXED_OTP must be unset in production']);
  });

  it('refuses test adapters against a non-local database even in development', () => {
    const issues = issuesOf({ ...local, ENVIRONMENT: 'development', DATABASE_URL: 'postgres://u@db.example.test/x' });
    expect(issues).toHaveLength(4);
    expect(issues[0]).toBe('AUTH_ADAPTER=test requires an isolated local DATABASE_URL');
  });

  it('requires TLS, https origin and approved privacy policy in production', () => {
    const issues = issuesOf({
      ...production,
      DATABASE_URL: 'postgres://app@db.internal/fancy',
      WEB_ORIGIN: 'http://app.example.test',
      PRIVACY_POLICY_VERSION: '',
      RETENTION_POLICY_JSON: '[]',
    });
    expect(issues).toEqual([
      'RETENTION_POLICY_JSON must be a JSON object',
      'DATABASE_URL must enable TLS (sslmode=require|verify-ca|verify-full) in production',
      'WEB_ORIGIN must be an https origin in production',
      'PRIVACY_POLICY_VERSION is required in production',
      'RETENTION_POLICY_JSON approved under G-PRIVACY is required in production',
    ]);
  });

  it('rejects unknown environments, adapters and missing database', () => {
    expect(() => loadConfig({})).toThrow(/ENVIRONMENT must be one of/);
    const issues = issuesOf({ ...local, DATABASE_URL: '', PLACES_ADAPTER: 'osm' });
    expect(issues).toEqual(['DATABASE_URL is required', 'PLACES_ADAPTER must be one of google/fixture']);
  });

  it('requires a long session secret, a web origin and Auth0 credentials for the Auth0 adapter', () => {
    expect(issuesOf({ ...local, SESSION_SECRET: 'short', WEB_ORIGIN: 'localhost' })).toEqual([
      'WEB_ORIGIN must be an origin (scheme://host[:port])',
      'SESSION_SECRET must be at least 32 characters',
    ]);
    expect(issuesOf({ ...production, AUTH0_CLIENT_SECRET: '' })).toEqual(['AUTH0_DOMAIN, AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET are required for AUTH_ADAPTER=auth0']);
    expect(issuesOf({ ...local, IOS_REDIRECT_URI: 'javascript:alert(1)' })).toEqual(['IOS_REDIRECT_URI must be a registered native redirect URI']);
    expect(loadConfig({ ...local, IOS_REDIRECT_URI: 'fancy://auth/callback', PORT: '4000' })).toMatchObject({ iosRedirectUri: 'fancy://auth/callback', port: 4000, auth0: null });
  });

  it('never echoes secret values in errors', () => {
    try {
      loadConfig({ ...production, AUTH_ADAPTER: 'test', DEV_FIXED_OTP: '987654' });
      throw new Error('expected rejection');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain('hunter2-secret');
      expect(message).not.toContain('987654');
      expect(message).not.toContain('prod-session-secret');
    }
  });
});
