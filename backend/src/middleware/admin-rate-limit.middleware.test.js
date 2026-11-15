import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminMutationLimit} from './admin-rate-limit.middleware.js';
test('per-actor mutation limit resets, excludes reads and provides retry guidance',()=>{
 let time=0,count=0,status=0,retry;const middleware=createAdminMutationLimit({max:2,windowMs:1000,now:()=>time});
 const response={set(key,value){retry=value;return this;},status(value){status=value;return this;},json(){}};
 const call=(method='POST',userId='7')=>middleware({method,auth:{userId}},response,()=>count++);
 call('GET');call();call();call();assert.equal(count,3);assert.equal(status,429);assert.equal(retry,'1');call('POST','8');assert.equal(count,4);time=1001;call();assert.equal(count,5);
});
