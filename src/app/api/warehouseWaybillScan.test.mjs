import test from 'node:test';
import assert from 'node:assert/strict';
import {scanRequest,scanResponse,scanFailureMessage} from './warehouseWaybillScan.js';
test('scan request preserves opaque QR bytes and decimal-string BIGINT; no actor/status fields',()=>{
  assert.deepEqual(scanRequest('9007199254740993',' QR-opaque '),{
    path:'/api/warehouse/shipments/9007199254740993/waybill/scan',body:{scannedIdentifier:' QR-opaque '}});
  for(const [id,qr] of [['0','QR'],['18446744073709551616','QR'],[41,'QR'],['41',''],['41','x'.repeat(121)]])assert.throws(()=>scanRequest(id,qr));
});
test('only matching confirmed server results produce success, preserving alreadyVerified',()=>{
  const data={verified:true,alreadyVerified:false,waybillId:'51',deliveryId:'41'};
  assert.deepEqual(scanResponse(data,'41'),data);assert.equal(scanResponse({...data,alreadyVerified:true},'41').alreadyVerified,true);
  for(const change of [{verified:false},{alreadyVerified:undefined},{waybillId:51},{deliveryId:'42'}])assert.throws(()=>scanResponse({...data,...change},'41'));
});
test('expected rejection and unknown-outcome messages are safe and never report unconfirmed success',()=>{
  for(const code of ['NOT_MATCHED','NOT_PRINTED','FORBIDDEN','WRITE_OUTCOME_UNKNOWN','CONFLICT','RATE_LIMITED'])assert.ok(scanFailureMessage({code}).length>0);
  assert.match(scanFailureMessage({status:401}),/Sign in again/);
  assert.match(scanFailureMessage({status:403}),/not authorized/);
  assert.doesNotMatch(scanFailureMessage({message:'RAW SQL SECRET'}),/RAW SQL SECRET/);
});
