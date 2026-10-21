import type { Pool } from 'pg';
import type { CoreConfig } from '@fancy/config';
import type { IdentityProvider } from '../identity/provider.ts';

export interface AuthContext {
  userId: string;
  familyId: string;
  sessionId: string;
  kind: 'WEB' | 'IOS' | 'SUPPORT_CLI';
  authTime: Date;
  amr: string[];
  /** Web only: the request authenticated with the session cookie (CSRF applies). */
  viaCookie: boolean;
}

export interface AppDeps {
  config: CoreConfig;
  pool: Pool;
  identity: IdentityProvider;
  /** Server origin used to build provider redirect URIs (e.g. https://app.example). */
  publicOrigin: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
