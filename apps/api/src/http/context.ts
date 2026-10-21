import type { Pool } from 'pg';
import type { CoreConfig } from '@fancy/config';
import type { IdentityProvider } from '../identity/provider.ts';
import type { PlacesProvider } from '../venues/provider.ts';
import type { AssistantRuntime, ModelProvider, ModelInput } from '../../../../packages/assistant/src/index.ts';
import type {VerifiedPrice} from '../assistant/provider-call.ts';

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
  placesProvider?: PlacesProvider;
  assistantRuntime?: AssistantRuntime;
  /** Explicit verified integration bundle; absent means model unavailable. Never infer
   * approval or prices merely from the existence of a provider credential. */
  assistant?: {allowedAreas:readonly string[];provider:ModelProvider;price:VerifiedPrice;countInputTokens:(request:ModelInput)=>number};
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
