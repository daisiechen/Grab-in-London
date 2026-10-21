import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {migrate} from '../../packages/db/src/index.ts';
import {loadConfig} from '../../packages/config/src/index.ts';
import {startPostgres17,type PostgresServer} from '../../packages/testkit/src/postgres/server.ts';
import {createMigratedDatabase,type MigratedDatabase} from '../../packages/testkit/src/db/index.ts';
import {buildServer} from '../../apps/api/src/http/server.ts';
import {LOCAL_STAFF_EMAIL,localFixtureIdentity,seedLocalStaff} from '../local-acceptance.ts';
let pg:PostgresServer,db:MigratedDatabase;
beforeAll(async()=>{pg=await startPostgres17();db=await createMigratedDatabase(pg.url,migrate);},60_000);
afterAll(async()=>{await db?.drop();await pg?.stop();});
it('refuses fixture construction without explicit local mode or in production',()=>{
 for(const env of [{},{FANCY_LOCAL_STAFF_FIXTURE:'1'},{FANCY_LOCAL_ACCEPTANCE:'1',ENVIRONMENT:'production'}])expect(()=>localFixtureIdentity(env)).toThrow();
});
it('seeds staff via core login before serving and gives only the explicit synthetic email fixture MFA and roles',async()=>{
 const env={FANCY_LOCAL_ACCEPTANCE:'1',FANCY_LOCAL_STAFF_FIXTURE:'1'};
 const config=loadConfig({ENVIRONMENT:'test',DATABASE_URL:db.url,AUTH_ADAPTER:'test',PLACES_ADAPTER:'fixture',MAIL_ADAPTER:'outbox_test',AI_PROVIDER:'disabled',WEB_ORIGIN:'http://127.0.0.1:5174',SESSION_SECRET:'local-fixture-test-secret-0123456789abcdef',IOS_REDIRECT_URI:'fancy://auth/callback'});
 const app=await buildServer({config,pool:db.pool,identity:localFixtureIdentity(env),publicOrigin:config.webOrigin});
 async function login(email:string){
  const headers={origin:config.webOrigin};
  const start=await app.inject({method:'POST',url:'/v1/auth/email/start',headers,payload:{clientRequestId:randomUUID(),email,client:'WEB'}});
  expect(start.statusCode).toBe(201);
  const verify=await app.inject({method:'POST',url:'/v1/auth/email/verify',headers,payload:{clientRequestId:randomUUID(),challengeId:start.json().data.challengeId,code:'000000'}});
  expect(verify.statusCode,verify.body).toBe(200);return verify;
 }
 try{
  await seedLocalStaff(app,db.pool,env);
  const bootstrap=await db.pool.query(`SELECT f.revoked_at FROM session_families f JOIN private_contact c ON c.user_id=f.user_id WHERE c.email=$1`,[LOCAL_STAFF_EMAIL]);
  expect(bootstrap.rows).toHaveLength(1);expect(bootstrap.rows.every(row=>row.revoked_at!==null)).toBe(true);
  const staff=await login(LOCAL_STAFF_EMAIL),ordinary=await login('qa-ordinary@example.invalid');
  expect(staff.json().data.session.user.roles.sort()).toEqual(['analyst','data_admin']);expect(staff.json().data.session.amr).toEqual(['otp','mfa']);
  expect(ordinary.json().data.session.user.roles).toEqual([]);expect(ordinary.json().data.session.amr).toEqual(['otp']);
  const staffCookie=staff.cookies.map(c=>`${c.name}=${c.value}`).join('; ');
  expect((await app.inject({url:'/v1/admin/snapshots',headers:{cookie:staffCookie}})).statusCode).toBe(200);
  const ordinaryCookie=ordinary.cookies.map(c=>`${c.name}=${c.value}`).join('; ');
  expect((await app.inject({url:'/v1/admin/snapshots',headers:{cookie:ordinaryCookie}})).statusCode).toBe(403);
  expect((await db.pool.query(`SELECT count(*)::int AS n FROM users u JOIN private_contact c ON c.user_id=u.id WHERE c.email=$1`,[LOCAL_STAFF_EMAIL])).rows[0].n).toBe(1);
  const disabled=localFixtureIdentity({FANCY_LOCAL_ACCEPTANCE:'1'});const challenge=await disabled.startEmailOtp(LOCAL_STAFF_EMAIL);
  expect((await disabled.verifyEmailOtp({email:LOCAL_STAFF_EMAIL,code:'000000',providerState:{ref:challenge.ref!}}))?.amr).toEqual(['otp']);
  // Disabled bootstrap never grants roles (use another database in real fresh runs); ordinary
  // identities above demonstrate that the enabled wrapper is scoped to exactly one address.
  await seedLocalStaff(app,db.pool,{FANCY_LOCAL_ACCEPTANCE:'1'});
 }finally{await app.close();}
},30_000);
