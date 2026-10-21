import type {FastifyRequest} from 'fastify';

/** Request logging is an allowlist: never serialize query, headers, body or the raw request. */
export function apiLoggerOptions(level:string){
 return {
  level,
  serializers:{
   req(request:FastifyRequest){
    const url=typeof request.url==='string'&&request.url.startsWith('/')?request.url.split(/[?#]/,1)[0]!:'[invalid path]';
    return {method:request.method,url,remoteAddress:request.ip,...(request.socket?.remotePort!==undefined?{remotePort:request.socket.remotePort}:{})};
   },
   // Provider error messages, stacks, causes and attached request/response objects may contain
   // credentials. Keep only bounded machine labels, including for Fastify's internal errors.
   err(error:{name?:unknown;code?:unknown}){
    return {type:'Error',message:'[redacted]',stack:'',...(typeof error?.name==='string'&&/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(error.name)?{name:error.name}:{}),
     ...(typeof error?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(error.code)?{code:error.code}:{})};
   },
  },
  redact:{paths:['req.headers.authorization','req.headers.cookie','req.headers["x-csrf-token"]','req.headers["ai-device-token"]','res.headers["set-cookie"]'],remove:true},
 };
}
