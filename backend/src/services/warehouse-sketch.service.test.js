import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWarehouseSketchService
} from './warehouse-sketch.service.js';

const actor = {
  accountType: 'employee',
  roleCode: 'warehouse',
  userId: '3'
};

// Signature-valid synthetic bytes for the retrieval contract test.
// Actual drawing rendering requires separate integration acceptance.
const buffer = Buffer.from('%PDF-1.4\nSynthetic test\n%%EOF');

const document = {
  itemId: '20',
  productName: 'Synthetic Filter',
  linkedId: '30',
  fileId: '30',
  originalFilename: 'filter-drawing.pdf',
  mimeType: 'application/pdf',
  sizeBytes: buffer.length,
  storageStatus: 'available',
  bucketName: 'local',
  objectKey: 'test/sketch.pdf',
  generation: 'test-version'
};

function fixture({
  records = [document],
  storedDocument = document,
  exists = true,
  wrongVersion = false,
  content = buffer,
  mimeType = 'application/pdf',
  storageFailure = false
} = {}) {
  const queries = [];
  const reads = [];

  const db = {
    async getConnection() {
      return {
        async execute(sql, params) {
          queries.push({sql, params});

          if (sql.includes('SELECT CAST(delivery_id AS CHAR) id')) {
            return [exists ? [{id:'7'}] : [], []];
          }

          if (sql.includes('doc.storage_key objectKey')) {
            return [storedDocument ? [storedDocument] : [], []];
          }

          return [records, []];
        },
        release() {}
      };
    }
  };

  const storage = {
    async get(args) {
      reads.push(args);

      if (storageFailure) throw new Error('Private storage path and credentials must never be returned');

      return {
        buffer: content,
        mimeType,
        generation: wrongVersion
          ? 'wrong-version'
          : 'test-version'
      };
    }
  };

  return {
    service: createWarehouseSketchService({db, storage}),
    queries,
    reads
  };
}

test('Warehouse receives only safe sketch metadata', async () => {
  const {service, queries, reads} = fixture();

  const result = await service.list(actor, '7');

  assert.equal(result.success, true);

  assert.deepEqual(result.data, [{
    itemId:'20',
    productName:'Synthetic Filter',
    status:'available',
    fileId:'30',
    originalFilename:'filter-drawing.pdf',
    mimeType:'application/pdf'
  }]);

  assert.match(queries[1].sql, /di\.jo_item_id=ji\.jo_item_id/);
  assert.match(queries[1].sql, /ji\.jo_id=d\.jo_id/);
  assert.match(queries[1].sql, /ji\.final_sketch_document_id/);
  assert.deepEqual(reads, []);
});

test('non-Warehouse actors cannot read sketches', async () => {
  const {service, queries, reads} = fixture();

  for (const roleCode of ['sales','admin','logistics','client']) {
    const other = {...actor, roleCode};

    assert.equal(
      (await service.list(other,'7')).code,
      'FORBIDDEN'
    );

    assert.equal(
      (await service.retrieve(other,'7','20','30')).code,
      'FORBIDDEN'
    );
  }

  assert.equal(queries.length,0);
  assert.equal(reads.length,0);
});

test('invalid IDs are rejected before database access', async () => {
  const {service, queries} = fixture();

  for (const value of ['0','-1','abc','18446744073709551616']) {
    assert.equal(
      (await service.retrieve(actor,'7','20',value)).code,
      'VALIDATION_ERROR'
    );
  }

  assert.equal(queries.length,0);
});

test('missing sketch differs from unavailable sketch', async () => {
  const {service} = fixture({
    records:[
      {...document, linkedId:null, fileId:null},
      {...document, itemId:'21', storageStatus:'pending'}
    ]
  });

  const result = await service.list(actor,'7');

  assert.deepEqual(
    result.data.map(row => row.status),
    ['none','unavailable']
  );

  assert.ok(result.data.every(row => row.fileId === null));
});

test('missing shipment is not an empty sketch list', async () => {
  const {service} = fixture({exists:false});

  assert.equal(
    (await service.list(actor,'7')).code,
    'NOT_FOUND'
  );
});

test('legacy unsafe filenames cannot disclose filesystem paths in sketch metadata',async()=>{
  const {service}=fixture({records:[
    {...document,originalFilename:'C:\\private\\drawing.pdf'},
    {...document,itemId:'21',originalFilename:'../../drawing.pdf'},
    {...document,itemId:'22',originalFilename:'drawing.exe'}
  ]});
  const result=await service.list(actor,'7');
  assert.equal(result.success,true);
  assert.ok(result.data.every(row=>row.status==='unavailable'&&row.fileId===null&&row.originalFilename===null));
});

test('retrieval uses the exact shipment, item and file relationship', async () => {
  const {service, queries, reads} = fixture();

  const result = await service.retrieve(actor,'7','20','30');

  assert.equal(result.success,true);
  assert.deepEqual(result.data.buffer,buffer);

  assert.deepEqual(
    queries[0].params,
    ['7','20','30']
  );

  assert.match(queries[0].sql, /ji\.jo_item_id=\?/);
  assert.match(queries[0].sql, /doc\.document_id=\?/);

  assert.deepEqual(reads,[{
    bucketName:'local',
    objectKey:'test/sketch.pdf',
    generation:'test-version'
  }]);
});

test('unrelated file does not trigger storage access', async () => {
  const {service, reads} = fixture({storedDocument:null});

  assert.equal(
    (await service.retrieve(actor,'7','20','99')).code,
    'NOT_FOUND'
  );

  assert.equal(reads.length,0);
});

test('mismatched document version fails closed', async () => {
  const {service} = fixture({wrongVersion:true});

  assert.equal(
    (await service.retrieve(actor,'7','20','30')).code,
    'DOCUMENT_RETRIEVAL_FAILED'
  );
});

for (const [mimeType, filename, content] of [
  ['image/png', 'drawing.png', Buffer.from('89504e470d0a1a0a00000000','hex')],
  ['image/jpeg', 'drawing.jpeg', Buffer.from('ffd8ffe00000','hex')]
]) {
  test(`exact allocated ${mimeType} bytes and filename survive retrieval`, async () => {
    const storedDocument = {...document, mimeType, originalFilename:filename, sizeBytes:content.length};
    const {service} = fixture({storedDocument, content, mimeType});
    const result = await service.retrieve(actor,'7','20','30');
    assert.equal(result.success,true);
    assert.deepEqual(result.data,{buffer:content,mimeType,originalFilename:filename});
  });
}

test('storage failure returns no private object identifiers or exception details',async()=>{
  const {service} = fixture({storageFailure:true});
  const result=await service.retrieve(actor,'7','20','30');
  assert.equal(result.success,false);
  assert.doesNotMatch(JSON.stringify(result),/Private|credentials|test\/sketch|objectKey|bucketName/);
});

test('invalid signature and size mismatch fail closed',async()=>{
  for(const content of [Buffer.from('not a PDF'),Buffer.concat([buffer,Buffer.from('extra')])]) {
    const {service}=fixture({content});
    assert.equal((await service.retrieve(actor,'7','20','30')).code,'DOCUMENT_RETRIEVAL_FAILED');
  }
});
