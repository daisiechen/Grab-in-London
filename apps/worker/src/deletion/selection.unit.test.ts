import {it,expect} from 'vitest';
import type {Pool} from 'pg';
import {loadConfig} from '@fancy/config';
import {deletionStepsFor,deletionPolicyApproved} from '../main.ts';
import {Auth0DeletionStep} from './auth0.ts';
import {UnavailableDeletionStep} from './provider.ts';
const env={ENVIRONMENT:'development',DATABASE_URL:'postgres://local@127.0.0.1:5432/unused',AUTH_ADAPTER:'auth0',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://127.0.0.1:5174',SESSION_SECRET:'synthetic-session-secret-more-than-32-characters',AUTH0_DOMAIN:'synthetic.auth0.example',AUTH0_CLIENT_ID:'login-client',AUTH0_CLIENT_SECRET:'login-fixture'};
const pool={query:()=>{throw Error('NO_IO_DURING_SELECTION');}} as unknown as Pool;
it('selects Management only with its separate complete configuration and never pretends Apple is complete',()=>{
 const config=loadConfig(env);expect(deletionStepsFor(pool,config).auth0).toBeInstanceOf(UnavailableDeletionStep);
 const ready=loadConfig({...env,AUTH0_MANAGEMENT_CLIENT_ID:'management-client',AUTH0_MANAGEMENT_CLIENT_SECRET:['synthetic','management','fixture'].join('-')});
 expect(deletionStepsFor(pool,ready).auth0).toBeInstanceOf(Auth0DeletionStep);expect(deletionStepsFor(pool,ready).apple).toBeInstanceOf(UnavailableDeletionStep);
 expect(deletionStepsFor(pool,loadConfig({...env,AUTH_ADAPTER:'test',AUTH0_MANAGEMENT_CLIENT_ID:'management-client',AUTH0_MANAGEMENT_CLIENT_SECRET:'synthetic-management'})).auth0).toBeInstanceOf(UnavailableDeletionStep);
});
it('requires an explicitly declared deletion policy approval and policy version independently of identity setup',()=>{
 expect(deletionPolicyApproved(loadConfig(env))).toBe(false);
 expect(deletionPolicyApproved(loadConfig({...env,PRIVACY_POLICY_VERSION:'synthetic-v1',RETENTION_POLICY_JSON:'{}'}))).toBe(false);
 expect(deletionPolicyApproved(loadConfig({...env,RETENTION_POLICY_JSON:'{"accountDeletionApproved":true}'}))).toBe(false);
 expect(deletionPolicyApproved(loadConfig({...env,PRIVACY_POLICY_VERSION:'synthetic-v1',RETENTION_POLICY_JSON:'{"accountDeletionApproved":true}'}))).toBe(true);
});
