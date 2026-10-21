import {expect,it} from 'vitest';
import {operations} from './registry.ts';
import type {OperationDef} from './operation.ts';
import {BlockState} from './dto.ts';
it('getBlock is an authenticated read-only projection of own BlockState without intent or If-Match',()=>{
 const operation=(operations as readonly OperationDef[]).find(o=>o.operationId==='getBlock');
 expect(operation).toMatchObject({method:'GET',path:'/blocks/{subjectId}',auth:'session',write:'read',ifMatch:false,success:{status:200,data:BlockState}});
 expect(operation?.body).toBeUndefined();expect(operation?.errors).toEqual(['NOT_FOUND','FORBIDDEN']);
});
