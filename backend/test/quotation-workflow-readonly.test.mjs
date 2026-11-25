import test from 'node:test';
import assert from 'node:assert/strict';
import { runQuotationReadOnlyAudit } from './quotation-workflow-readonly.mjs';

test('read-only diagnostic reports missing quotation_addon and continues without querying its columns',async()=>{
  const calls=[], output=[];
  let released=false, rolledBack=false;
  const columns=['quotation_id','inquiry_id','status','revision_no','is_current','subtotal','total_amount','sent_at'];
  const c={release(){released=true;},async rollback(){rolledBack=true;},async query(sql){
    calls.push({protocol:'query',sql});
    assert.equal(sql,'START TRANSACTION READ ONLY');
    return [];
  },async execute(sql,params=[]){
    // Model the actual MySQL protocol restriction, rather than accepting
    // transaction control in the test double's prepared-statement method.
    if(sql.startsWith('START TRANSACTION'))throw Object.assign(new Error('Unsupported prepared statement'),{code:'ER_UNSUPPORTED_PS'});
    calls.push({sql,params});
    assert.match(sql,/^(SELECT|SHOW COLUMNS)\b/);
    assert.doesNotMatch(sql,/migration|checksum|schema_history/i);
    if(sql.startsWith('SELECT DATABASE()'))return [[{databaseName:'offline_double',version:'8.4.13'}]];
    if(sql.includes('TABLE_NAME IN'))return [params.filter(name=>name!=='quotation_addon').map(tableName=>({tableName}))];
    if(sql.includes('TABLE_NAME LIKE'))return [[{tableName:'quotation'},{tableName:'quotation_item'}]];
    if(sql.startsWith('SHOW COLUMNS')){
      assert.notEqual(sql,'SHOW COLUMNS FROM quotation_addon');
      return [columns.map(Field=>({Field,Type:'offline'}))];
    }
    if(sql.includes('FROM quotation ORDER BY')){
      assert.doesNotMatch(sql,/addons_total/);
      return [[]];
    }
    throw new Error('Unexpected diagnostic SQL');
  }};
  const healthy=await runQuotationReadOnlyAudit({getConnection:async()=>c},{log:value=>output.push(JSON.parse(value)),error:value=>output.push(JSON.parse(value))});
  assert.equal(healthy,false);
  assert.deepEqual(output.find(row=>row.missingBusinessTables)?.missingBusinessTables,['quotation_addon']);
  assert.deepEqual(output.find(row=>row.missingColumns)?.missingColumns,['addons_total']);
  assert.ok(output.some(row=>row.table==='cost_estimate'));
  assert.ok(output.some(row=>Array.isArray(row.quotations)));
  assert.ok(released && rolledBack);
  assert.deepEqual(calls[0],{protocol:'query',sql:'START TRANSACTION READ ONLY'});
});
test('diagnostic reports the exact failed transaction operation and still releases the connection',async()=>{
  const errors=[];
  let rolledBack=false,released=false,prepared=false;
  const c={async query(sql){assert.equal(sql,'START TRANSACTION READ ONLY');throw Object.assign(new Error('private server details'),{code:'ER_UNSUPPORTED_PS'});},async execute(){prepared=true;},async rollback(){rolledBack=true;},release(){released=true;}};
  assert.equal(await runQuotationReadOnlyAudit({getConnection:async()=>c},{log(){},error:value=>errors.push(JSON.parse(value))}),false);
  assert.deepEqual(errors,[{diagnosticFailed:true,operation:'begin_read_only_transaction',code:'ER_UNSUPPORTED_PS'}]);
  assert.ok(rolledBack&&released);assert.equal(prepared,false);
});
