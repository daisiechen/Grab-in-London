import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,inject,it} from 'vitest';
import {browserLogin} from '../../../support-cli/src/auth.ts';
import {createHarness,type Harness} from '../test/harness.ts';

let h:Harness;
beforeAll(async()=>{h=await createHarness(inject('pgServerUrl'));});
afterAll(async()=>{await h.close();});

it('connects the CLI loopback listener to the real HTTP core callback and PKCE exchange',async()=>{
  const origin=await h.app.listen({host:'127.0.0.1',port:0});
  const access=await browserLogin(origin,{timeoutMs:5000,openBrowser:async authorizationUrl=>{
    // Controlled test IDP consent replaces the external browser/provider only.
    expect(new URL(new URL(authorizationUrl).searchParams.get('redirect_uri')!).pathname).toBe('/v1/auth/oauth/callback');
    const grant=h.idp.consent(authorizationUrl,{subject:randomUUID()});
    const callback=await fetch(`${origin}/v1/auth/oauth/callback?${new URLSearchParams(grant)}`,{redirect:'manual'});
    expect(callback.status).toBe(303);
    const location=callback.headers.get('location')!;
    expect(new URL(location).hostname).toBe('127.0.0.1');
    const local=await fetch(location,{redirect:'error'});
    expect(local.status).toBe(200);
    expect(await local.text()).not.toContain(new URL(location).searchParams.get('code'));
  }});
  const session=await fetch(`${origin}/v1/auth/session`,{headers:{authorization:`Bearer ${access.accessToken}`}});
  expect(session.status).toBe(200);
  const denied=await fetch(`${origin}/v1/support/cases/${randomUUID()}`,{headers:{authorization:`Bearer ${access.accessToken}`}});
  expect(denied.status).toBe(403);
  expect((await h.db.pool.query('SELECT count(*)::int n FROM refresh_tokens')).rows[0].n).toBe(0);
});
