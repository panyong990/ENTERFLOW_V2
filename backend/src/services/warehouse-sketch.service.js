import {
  ok, fail, read, rows, one, id
} from '../phase2/core.js';

import {
  createLocalDocumentStorage,
  createGcsDocumentStorage,
  validateDocumentBuffer,
  extensionForMime,
  DOCUMENT_LIMITS
} from '../storage/document-storage.js';

const authorized = actor =>
  actor?.accountType === 'employee' &&
  actor.roleCode === 'warehouse' &&
  id(actor.userId);

const validId = value =>
  typeof value === 'string' &&
  /^[1-9]\d{0,19}$/.test(value) &&
  BigInt(value) <= 18446744073709551615n;

const allocation = `
  FROM delivery d
  JOIN job_order_item ji
    ON ji.jo_id=d.jo_id
  LEFT JOIN document doc
    ON doc.document_id=ji.final_sketch_document_id
  WHERE d.delivery_id=?
    AND EXISTS (
      SELECT 1
      FROM delivery_item di
      WHERE di.delivery_id=d.delivery_id
        AND di.jo_item_id=ji.jo_item_id
    )
`;

function available(row) {
  const filename = row.originalFilename;
  const extension = typeof filename === 'string'
    ? filename.toLowerCase().split('.').pop() : '';
  const expectedExtension = extensionForMime(row.mimeType);
  return Boolean(
    row.fileId &&
    row.storageStatus === 'available' &&
    typeof filename === 'string' && filename.trim() &&
    filename.length <= 255 && !filename.startsWith('.') &&
    !/[\x00-\x1f\x7f/\\]/.test(filename) &&
    expectedExtension &&
    (extension === expectedExtension ||
      (row.mimeType === 'image/jpeg' && extension === 'jpeg')) &&
    Number.isSafeInteger(Number(row.sizeBytes)) &&
    Number(row.sizeBytes) > 0 &&
    Number(row.sizeBytes) <= DOCUMENT_LIMITS.sketch
  );
}

export function createWarehouseSketchService({ db, storage }) {
  const objects = storage ?? {
    get(args) {
      return args.bucketName === 'local'
        ? createLocalDocumentStorage().get(args)
        : createGcsDocumentStorage().get(args);
    }
  };

  return {
    async list(actor, deliveryId) {
      if (!authorized(actor)) return fail('FORBIDDEN');
      if (!validId(deliveryId)) return fail('VALIDATION_ERROR');

      return read(db, async c => {
        const delivery = await one(c, `
          SELECT CAST(delivery_id AS CHAR) id
          FROM delivery
          WHERE delivery_id=?
        `, [deliveryId]);

        if (!delivery) return fail('NOT_FOUND');

        const records = await rows(c, `
          SELECT CAST(ji.jo_item_id AS CHAR) itemId,
                 ji.item_name productName,
                 CAST(ji.final_sketch_document_id AS CHAR) linkedId,
                 CAST(doc.document_id AS CHAR) fileId,
                 doc.file_name originalFilename,
                 doc.mime_type mimeType,
                 doc.size_bytes sizeBytes,
                 doc.storage_status storageStatus
          ${allocation}
          ORDER BY ji.line_no, ji.jo_item_id
        `, [deliveryId]);

        return ok(records.map(row => {
          const ready = available(row);

          return {
            itemId: row.itemId,
            productName: row.productName,
            status: !row.linkedId
              ? 'none'
              : ready ? 'available' : 'unavailable',
            fileId: ready ? row.fileId : null,
            originalFilename: ready ? row.originalFilename : null,
            mimeType: ready ? row.mimeType : null
          };
        }));
      });
    },

    async retrieve(actor, deliveryId, itemId, fileId) {
      if (!authorized(actor)) return fail('FORBIDDEN');

      if (![deliveryId, itemId, fileId].every(validId)) {
        return fail('VALIDATION_ERROR');
      }

      return read(db, async c => {
        const doc = await one(c, `
          SELECT CAST(doc.document_id AS CHAR) fileId,
                 doc.file_name originalFilename,
                 doc.mime_type mimeType,
                 doc.size_bytes sizeBytes,
                 doc.storage_status storageStatus,
                 doc.storage_bucket bucketName,
                 doc.storage_key objectKey,
                 doc.object_generation generation
          ${allocation}
            AND ji.jo_item_id=?
            AND doc.document_id=?
            AND doc.storage_status='available'
        `, [deliveryId, itemId, fileId]);

        if (!doc) return fail('NOT_FOUND');

        if (
          !available(doc) ||
          !doc.bucketName ||
          !doc.objectKey
        ) {
          return fail('DOCUMENT_RETRIEVAL_FAILED');
        }

        const object = await objects.get({
          bucketName: doc.bucketName,
          objectKey: doc.objectKey,
          generation: doc.generation
        });

        const validation = validateDocumentBuffer({
          buffer: object.buffer,
          filename: doc.originalFilename,
          mimeType: doc.mimeType,
          kind: 'sketch'
        });

        if (
          !validation.success ||
          object.buffer.length !== Number(doc.sizeBytes) ||
          object.mimeType !== doc.mimeType ||
          (
            doc.generation != null &&
            String(object.generation) !== String(doc.generation)
          )
        ) {
          return fail('DOCUMENT_RETRIEVAL_FAILED');
        }

        return ok({
          buffer: object.buffer,
          originalFilename: doc.originalFilename,
          mimeType: doc.mimeType
        });
      });
    }
  };
}
