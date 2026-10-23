import {EventEmitter} from 'node:events';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {describe,expect,it,vi} from 'vitest';
import {makeAdminFaults} from './faults.ts';
const origin='http://p11-admin.localhost:64275';
function request(faults:ReturnType<typeof makeAdminFaults>,url:string,method='GET',requestOrigin=origin){
 const headers:Record<string,string>={};const res={statusCode:200,setHeader:(key:string,value:string)=>{headers[key]=value;},end:vi.fn()};const next=vi.fn();
 faults.middleware({url,method,headers:{origin:requestOrigin}} as IncomingMessage,res as unknown as ServerResponse,next);
 return {res,next,headers};
}
describe('synthetic admin one-shot fault boundary',()=>{
 it('rejects cross-origin controls and refuses unknown actions',()=>{
  const f=makeAdminFaults(origin);
  expect(request(f,'/__admin-test/fault/503','POST','http://other.invalid').res.statusCode).toBe(403);
  expect(request(f,'/__admin-test/fault/503').res.statusCode).toBe(403);
  expect(request(f,'/__admin-test/fault/unknown','POST').res.statusCode).toBe(400);
  expect(request(f,'/v1/admin/supply').next).toHaveBeenCalledOnce();
 });
 it.each([429,503] as const)('fails only one page call with %s and leaves session reads alone',status=>{
  const f=makeAdminFaults(origin);request(f,'/__admin-test/fault/'+status,'POST');
  expect(request(f,'/v1/auth/session').next).toHaveBeenCalledOnce();
  const first=request(f,'/v1/admin/supply?snapshotId=synthetic');expect(first.res.statusCode).toBe(status);
  expect(first.headers['cache-control']).toBe('no-store');if(status===429)expect(first.headers['retry-after']).toBe('3');
  expect(request(f,'/v1/admin/supply').next).toHaveBeenCalledOnce();
 });
 it('drops exactly one committed classification response, never a receipt read',()=>{
  const f=makeAdminFaults(origin),proxy=new EventEmitter();f.attach(proxy);request(f,'/__admin-test/fault/lost-classify','POST');
  const upstream={destroy:vi.fn()},res={destroy:vi.fn()};
  proxy.emit('proxyRes',upstream,{method:'GET',url:'/v1/me/command-receipts/classifyUser/key'},res);expect(res.destroy).not.toHaveBeenCalled();
  proxy.emit('proxyRes',upstream,{method:'PUT',url:'/v1/admin/classifications/synthetic'},res);expect(res.destroy).toHaveBeenCalledOnce();
  proxy.emit('proxyRes',upstream,{method:'PUT',url:'/v1/admin/classifications/synthetic'},res);expect(res.destroy).toHaveBeenCalledOnce();
 });
});


it.each([['slow-classify','PUT'],['slow-classification-read','GET']])('delays only the next matching %s request',async(action,method)=>{
 vi.useFakeTimers();
 try{
  const f=makeAdminFaults(origin);request(f,'/__admin-test/fault/'+action,'POST');
  expect(request(f,'/v1/auth/session').next).toHaveBeenCalledOnce();
  const first=request(f,'/v1/admin/classifications/synthetic',method);expect(first.next).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(4999);expect(first.next).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);expect(first.next).toHaveBeenCalledOnce();
  expect(request(f,'/v1/admin/classifications/synthetic',method).next).toHaveBeenCalledOnce();
 }finally{vi.useRealTimers();}
});
