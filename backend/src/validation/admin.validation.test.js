import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAdminRequest} from './admin.validation.js';
const profile={employeeId:'QA-1',name:'Synthetic',department:'QA',jobTitle:'Tester',email:'qa@example.invalid',username:'qa',phone:''};
test('precise BIGINT IDs and bounded server filters',()=>{
 assert.equal(validateAdminRequest('employee',{id:'18446744073709551615'}).success,true);
 for(const id of [1,'0','01','18446744073709551616','1 OR 1=1'])assert.equal(validateAdminRequest('employee',{id}).success,false);
 for(const query of [{page:'0'},{pageSize:'101'},{sort:'name; DROP TABLE users'},{status:'pending'},{role:'client'},{q:['a']},{actor:'7'}])assert.equal(validateAdminRequest('employees',{query}).success,false);
});
for(const field of ['passwordHash','active','accountType','clientId','actor','roleCode'])test(`profile rejects privileged ${field}`,()=>{
 assert.equal(validateAdminRequest('updateEmployee',{id:'8',body:{...profile,revision:'a'.repeat(64),[field]:'admin'}}).success,false);
});
test('creation requires all fields and allows only existing non-Admin employee roles',()=>{
 const body={...profile,roleCode:'sales',initialPassword:'synthetic-only-123'};
 assert.equal(validateAdminRequest('createEmployee',{body}).success,true);
 for(const roleCode of ['admin','client','unknown'])assert.equal(validateAdminRequest('createEmployee',{body:{...body,roleCode}}).success,false);
 for(const key of ['employeeId','name','department','jobTitle','email','username','initialPassword']){const copy={...body};delete copy[key];assert.equal(validateAdminRequest('createEmployee',{body:copy}).success,false);}
});
test('invalid email, Unicode length, malformed Unicode and revision rejected',()=>{
 for(const body of [{...profile,email:'invalid'},{...profile,name:'x'.repeat(161)},{...profile,name:'\ud800'},{...profile,revision:'bad'}])assert.equal(validateAdminRequest('updateEmployee',{id:'8',body:{revision:'a'.repeat(64),...body}}).success,false);
});
test('status commands require a revision and reject status/actor overrides',()=>{
 assert.equal(validateAdminRequest('deactivateClient',{id:'8',body:{revision:'a'.repeat(64)}}).success,true);
 for(const body of [{},{revision:'a'.repeat(64),active:true}])assert.equal(validateAdminRequest('deactivateClient',{id:'8',body}).success,false);
});
test('accessors, symbols and inherited input are rejected without invoking code',()=>{
 let accessed=false;const body={};Object.defineProperty(body,'revision',{enumerable:true,get(){accessed=true;return 'a'.repeat(64);}});
 for(const input of [body,{[Symbol('hidden')]:true},Object.create({revision:'a'.repeat(64)})])assert.equal(validateAdminRequest('deactivateClient',{id:'8',body:input}).success,false);
 assert.equal(accessed,false);
});
