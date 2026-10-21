import Fastify from 'fastify';
import {expect,it} from 'vitest';
import {apiLoggerOptions} from './logging.ts';
import {errorHandler} from './errors.ts';
it('real info logs preserve request correlation and latency but exclude callback queries and credentials',async()=>{
 const logs:string[]=[];const app=Fastify({logger:{...apiLoggerOptions('info'),stream:{write:(chunk:string)=>{logs.push(chunk);}}}});
 app.setErrorHandler(errorHandler);
 const query={code:'synthetic-authorization-secret',state:'synthetic-provider-state',email:'private-synthetic@example.invalid'};
 const authorization='Bearer synthetic-bearer-secret',cookie='session=synthetic-cookie-secret';
 app.get('/v1/auth/oauth/callback',async request=>({unchanged:request.url.includes(query.code)&&request.url.includes(query.state)}));
 app.get('/controlled-error',async()=>{throw new Error(`Provider rejected https://provider.invalid/?code=${query.code}`);});
 try{
  const callback=await app.inject({url:`/v1/auth/oauth/callback?${new URLSearchParams(query)}`,headers:{authorization,cookie,'x-csrf-token':'synthetic-csrf-secret'}});
  expect(callback.statusCode).toBe(200);expect(callback.json()).toEqual({unchanged:true});
  expect((await app.inject('/controlled-error')).statusCode).toBe(500);
  const raw=logs.join('');
  expect(Object.values(query).map(value=>raw.includes(value))).toEqual([false,false,false]);
  expect([authorization,cookie,'synthetic-csrf-secret','https://provider.invalid'].map(value=>raw.includes(value))).toEqual([false,false,false,false]);
  const records=logs.map(line=>JSON.parse(line));
  const incoming=records.find(row=>row.req?.url==='/v1/auth/oauth/callback');
  expect(incoming?.reqId).toBeTruthy();expect(incoming?.req.method).toBe('GET');
  expect(records.some(row=>row.reqId===incoming.reqId&&typeof row.responseTime==='number'&&row.res?.statusCode===200)).toBe(true);
 }finally{await app.close();}
});

it('real Pino error serializer drops raw message, stack, cause and attached callback URL',async()=>{
 const logs:string[]=[];const app=Fastify({logger:{...apiLoggerOptions('info'),stream:{write:(chunk:string)=>{logs.push(chunk);}}}});
 const secret='synthetic-private-error-marker';
 try{
  const error=Object.assign(new Error(`https://provider.invalid/?code=${secret}`),{code:'PROVIDER_UNAVAILABLE',cause:new Error(secret),request:{url:secret}});
  app.log.error({err:error},'provider unavailable');
  const raw=logs.join('');expect(raw.includes(secret)).toBe(false);expect(raw.includes('https://provider.invalid')).toBe(false);
  const row=JSON.parse(raw);expect(row.err).toEqual({type:'Error',message:'[redacted]',stack:'',name:'Error',code:'PROVIDER_UNAVAILABLE'});
 }finally{await app.close();}
});
