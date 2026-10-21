import {expect,it} from 'vitest';
import {buildRealPlan,assertRealStartAllowed,publicPlan,webChildEnvironment,postgresEnvironment} from '../real-integration.ts';
const credentials={AUTH0_DOMAIN:'synthetic.auth0.example',AUTH0_CLIENT_ID:'synthetic-client',AUTH0_CLIENT_SECRET:'synthetic-private-value',GOOGLE_MAPS_API_KEY:'synthetic-server-key',SESSION_SECRET:'synthetic-session-secret-more-than-32-characters'};
it('builds only real identity/places with AI disabled and ignores inherited fixture and existing database configuration',()=>{
 const plan=buildRealPlan({...credentials,DATABASE_URL:'postgres://existing.invalid/production',DEV_FIXED_OTP:'000000',AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',AI_PROVIDER:'mock',DEEPSEEK_API_KEY:'must-not-load'}, {AUTH_ADAPTER:'test',FANCY_TEST_DATABASE_URL:'postgres://qa.invalid/db'});
 expect(plan.config.adapters).toMatchObject({AUTH_ADAPTER:'auth0',PLACES_ADAPTER:'google',MAIL_ADAPTER:'provider',AI_PROVIDER:'disabled'});
 expect(plan.config.databaseUrl).not.toContain('existing');expect(plan.config.devFixedOtp).toBeNull();expect(plan.config.webOrigin).toBe('http://127.0.0.1:5174');
 expect(JSON.stringify(publicPlan(plan))).not.toContain(credentials.AUTH0_CLIENT_SECRET);expect(JSON.stringify(publicPlan(plan))).not.toContain(credentials.GOOGLE_MAPS_API_KEY);
});
it('refuses start until explicit real mode and QA port release are both present',()=>{
 for(const env of [{},{FANCY_REAL_INTEGRATION:'1'},{FANCY_REAL_PORT_5174_RELEASED:'1'}])expect(()=>assertRealStartAllowed(env)).toThrow();
 expect(()=>assertRealStartAllowed({FANCY_REAL_INTEGRATION:'1',FANCY_REAL_PORT_5174_RELEASED:'1'})).not.toThrow();
});
it('does not pass private root/provider data to the web child or attach to any existing PG server',()=>{
 const env={PATH:'/bin',HOME:'/tmp/example',FANCY_PG_BIN:'/tmp/pg17',FANCY_TEST_DATABASE_URL:'postgres://qa.invalid/db',DATABASE_URL:'private-db',...credentials};
 expect(postgresEnvironment(env)).toEqual({FANCY_PG_BIN:'/tmp/pg17'});
 expect(webChildEnvironment(env,'http://127.0.0.1:62099')).toEqual({PATH:'/bin',HOME:'/tmp/example',FANCY_API_ORIGIN:'http://127.0.0.1:62099'});
});
it('reports missing configuration by key name only and never echoes supplied values',()=>{
 let message='';try{buildRealPlan({AUTH0_CLIENT_SECRET:'PRIVATE-SENTINEL'},{});}catch(error){message=(error as Error).message;}
 expect(message).toContain('AUTH0_DOMAIN');expect(message).not.toContain('PRIVATE-SENTINEL');
});
