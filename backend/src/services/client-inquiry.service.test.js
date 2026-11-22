import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientInquiryService } from './client-inquiry.service.js';

function harness() {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    async execute(sql, params) {
      calls.push({ sql, params });
      if(sql.includes('FROM user_account u JOIN role r')&&sql.includes('FOR SHARE'))return [[{userId:'9',roleCode:'client',status:'active',mustChangePassword:0,clientId:'21',clientStatus:'active'}]];
      if(sql.includes('FROM user_account u JOIN role r'))return [[]];
      if(sql.includes('FROM filter_type'))return [[{id:'1'}]];
      if(sql.startsWith('SELECT DATE_FORMAT(created_at'))return [[{submittedAt:'2026-11-22T00:00:00.000Z'}]];
      if(sql.startsWith('INSERT INTO audit_event'))return [{affectedRows:1,insertId:'1'}];
      if (sql.includes('INSERT INTO document_sequences')) return [{ affectedRows: 1 }];
      if (sql.includes('SELECT `last_value`')) return [[{ last_value: '7' }]];
      if(sql.includes('INSERT INTO inquiry('))return [{insertId:'91',affectedRows:1}];
      if (sql.includes('INSERT INTO product_specifications')) return [{ insertId: '101' }];
      if(sql.includes('INSERT INTO inquiry_item'))return [{insertId:'201',affectedRows:1}];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() { calls.push('release'); }
  };
  return { calls, service: createClientInquiryService({ db: { getConnection: async () => connection } }) };
}

const input = {
  contactPerson: 'Client Contact', paymentTermCode: 'NET30', requestedDeliveryDate: '2026-12-01',
  generalNotes: 'Please confirm dimensions.', products: [{ type: 'AIRFIL', filterName: 'AHU Filter', quantity: 20,
    specifications: { od1: '100', media: 'Microglass', filtrationRating: '10-micron', notes: 'Test' } }]
};

test('creates a client-owned inquiry and specification/item rows in one transaction', async () => {
  const h = harness();
  const result = await h.service.createInquiry('21', '9', input);
  assert.equal(result.success, true);
  assert.equal(result.data.id, '91');
  assert.match(result.data.reference,/^INQ-[a-f0-9-]{36}$/);
  assert.equal(result.data.stageCode, 'inquiry');
  assert.equal(result.data.itemCount, 1);
  assert.equal(h.calls[0], 'begin');
  assert.equal(h.calls[1].sql.includes('FROM user_account u JOIN role r'), true);
  assert.deepEqual(h.calls[1].params, ['9']);
  assert.equal(h.calls.at(-2), 'commit');
  assert.equal(h.calls.at(-1), 'release');
});

test('rejects invalid inquiry data before opening a database connection', async () => {
  let opened = false;
  const service = createClientInquiryService({ db: { getConnection: async () => { opened = true; throw new Error('must not open'); } } });
  const result = await service.createInquiry('21', '9', { ...input, paymentTermCode: 'COD', products: [] });
  assert.equal(result.code, 'VALIDATION_ERROR');
  assert.equal(opened, false);
});
