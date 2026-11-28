
import { createHash, randomUUID } from 'node:crypto';
import {
  createLocalDocumentStorage,
  createGcsDocumentStorage,
  validateDocumentBuffer,
  objectKeyFor
} from '../storage/document-storage.js';
import { validateClientInquiry } from '../validation/client-inquiry.validation.js';
import { createAccountingService } from './accounting.js';
import { allowPurchaseOrderSubmission } from './workflows.js';
import { createPoUploadDiagnostics } from '../controllers/service-failure-log.js';
import { currentRequestId } from '../config/request-context.js';
import { ok, fail, read, rows, one, id, text, object, requireThat, paymentTerm, paging, decimal, format, transaction, authorize, lockInquiry, insert, changed, audit, reference } from './core.js';

export const validSubmissionKey = key =>
  typeof key === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key);

export function createDocumentWorkflowsService({
  db,
  storage,
  bucketName = process.env.GCS_BUCKET,
  logger = console
} = {}) {
  const storageDriver = process.env.DOCUMENT_STORAGE_DRIVER || 'local';

  const localStorage = createLocalDocumentStorage();
  const gcsStorage = createGcsDocumentStorage({ bucketName });

  const objects = storage ?? {
    put: args => {
      if (storageDriver === 'local') return localStorage.put(args);
      if (storageDriver === 'gcs') return gcsStorage.put(args);
      throw new Error(`Unsupported document storage driver: ${storageDriver}`);
    },

    get: args => {
      if (args.bucketName === 'local') return localStorage.get(args);
      return gcsStorage.get(args);
    },

    delete: args => {
      if (args.bucketName === 'local') return localStorage.delete(args);
      return gcsStorage.delete(args);
    }
  };

  async function store(c, a, file, kind, scope, parentId, staged, diagnostics) {
    diagnostics?.stage('document_validation');
    requireThat(
      storage ||
      storageDriver === 'local' ||
      (storageDriver === 'gcs' && bucketName),
      'STORAGE_NOT_CONFIGURED'
    );

    const valid = validateDocumentBuffer({
      ...file,
      kind
    });

    requireThat(valid.success, 'INVALID_DOCUMENT');

    const digest = createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    diagnostics?.stage('document_insert');
    const documentId = await insert(
      c,
      "INSERT INTO document(file_name,mime_type,size_bytes,sha256,storage_status,uploaded_by_user_id) VALUES (?,?,?,?,'pending',?)",
      [
        valid.data.filename,
        file.mimeType,
        file.buffer.length,
        digest,
        a.userId
      ]
    );

    const objectKey = objectKeyFor({
      scope,
      parentId,
      fileId: documentId,
      extension: valid.data.extension
    });

    const documentBucket = storage
      ? bucketName
      : storageDriver === 'local'
        ? 'local'
        : bucketName;

    const pending = {
      objectKey,
      bucketName: documentBucket,
      documentId,
      generation: null
    };

    staged.push(pending);

    diagnostics?.stage('storage_put');
    const saved = await objects.put({
      objectKey,
      buffer: file.buffer,
      mimeType: file.mimeType
    });

    requireThat(
      saved &&
      typeof saved.generation === 'string' &&
      saved.generation.length > 0 &&
      saved.generation.length <= 40,
      'DOCUMENT_UPLOAD_FAILED'
    );

    pending.generation = saved.generation;

    diagnostics?.stage('document_available');
    await changed(
      c,
      "UPDATE document SET storage_bucket=?,storage_key=?,object_generation=?,storage_status='available' WHERE document_id=? AND storage_status='pending'",
      [
        documentBucket,
        objectKey,
        saved.generation,
        documentId
      ]
    );

    return documentId;
  }

  async function withObjects(actor, roles, work, diagnostics) {
    const staged = [];

    const result = await transaction(
      db,
      actor,
      roles,
      (c, a) => work(c, a, staged, diagnostics),
      { diagnostics }
    );

    if (!result.success && result.code !== 'WRITE_OUTCOME_UNKNOWN') {
      for (const item of staged) {
        try {
          await objects.delete(item);
        } catch (error) {
          diagnostics?.error(error, 'storage_cleanup');
          await read(db, async c => {
            await audit(
              c,
              actor,
              'document.cleanup_pending',
              'document',
              item.documentId,
              null,
              {
                bucket: item.bucketName,
                key: item.objectKey,
                generation: item.generation
              }
            );

            return ok(null);
          }, diagnostics ? error => diagnostics.error(error, 'cleanup_audit') : undefined);
        }
      }
    }

    return result;
  }

  const client = (clientId, userId) => ({
    userId,
    clientId,
    roleCode: 'client',
    accountType: 'client'
  });

  const service = {
    uploadPurchaseOrder: ({
      clientId,
      userId,
      orderId,
      file,
      documentId,
      quotationId,
      context = {}
    }) => withObjects(
      client(clientId, userId),
      ['client'],
      async (c, a, staged, diagnostics) => {
        diagnostics.stage('inquiry_lock');
        const i = await lockInquiry(c, orderId, a.clientId);

        requireThat(
          !['cancelled', 'rejected', 'archived'].includes(i.status),
          'INVALID_STATE'
        );


        diagnostics.stage('quotation_lookup');
        const q = await one(
          c,
          "SELECT CAST(quotation_id AS CHAR) id,terms_of_payment paymentTermCode FROM quotation WHERE inquiry_id=? AND is_current=1 AND status='accepted' FOR UPDATE",
          [orderId]
        );

        requireThat(
          q && (!quotationId || quotationId === q.id),
          'QUOTATION_NOT_ACCEPTED'
        );

        diagnostics.stage('duplicate_check');
        await allowPurchaseOrderSubmission(c, orderId);

        const doc = await store(
          c,
          a,
          file,
          'po',
          'purchase-orders',
          orderId,
          staged,
          diagnostics
        );

        diagnostics.stage('po_reference');
        const poReference = reference('PO');
        diagnostics.stage('po_insert');
        const po = await insert(
          c,
          'INSERT INTO purchase_order(po_no,quotation_id,po_document_id,received_date,payment_terms,recorded_by_user_id) VALUES (?,?,?,UTC_DATE(),?,?)',
          [
            poReference,
            q.id,
            doc,
            paymentTerm(q.paymentTermCode),
            a.userId
          ]
        );

        diagnostics.stage('inquiry_update');
        await changed(
          c,
          "UPDATE inquiry SET status='po' WHERE inquiry_id=?",
          [orderId]
        );

        diagnostics.stage('po_audit');
        await audit(
          c,
          a,
          'purchase_order.received',
          'purchase_order',
          po,
          null,
          {
            inquiryId: orderId,
            quotationId: q.id,
            documentId: doc
          }
        );

        return ok({
          id: po,
          reference: poReference,
          fileId: doc
        });
      },
      createPoUploadDiagnostics({ logger, requestId: currentRequestId() ?? context.requestId })
    ),

    uploadPaymentProof: ({
      clientId,
      userId,
      orderId,
      invoiceId,
      amount,
      method,
      paymentMethodId,
      file,
      files,
      referenceNumber,
      note
    }) => withObjects(
      client(clientId, userId),
      ['client'],
      async (c, a, staged) => {
        const i = await lockInquiry(c, orderId, a.clientId);

        requireThat(
          !['cancelled', 'rejected', 'archived'].includes(i.status),
          'INVALID_STATE'
        );

        requireThat(id(invoiceId));

        const invoice = await one(
          c,
          'SELECT v.* FROM sales_invoice v JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE v.invoice_id=? AND q.inquiry_id=? FOR UPDATE',
          [invoiceId, orderId]
        );

        requireThat(
          invoice && invoice.status !== 'cancelled',
          'INVOICE_NOT_ISSUED'
        );

        const sum = await one(
          c,
          "SELECT COALESCE(SUM(amount),0) amount FROM payment_transaction WHERE invoice_id=? AND approval_status='approved'",
          [invoiceId]
        );

        const value = decimal(amount, 2);

        requireThat(
          value > 0n &&
          value + decimal(sum.amount, 2) <= decimal(invoice.total_amount, 2),
          'PAYMENT_AMOUNT_EXCEEDED'
        );

        const methodId = paymentMethodId ?? method;

        requireThat(
          typeof methodId === 'string' &&
          methodId.length > 0 &&
          methodId.length <= 100,
          'REFERENCE_DATA_MISSING'
        );

        const pm = await one(
          c,
          `SELECT CAST(payment_method_id AS CHAR) id FROM payment_method WHERE ${id(methodId) ? 'payment_method_id' : 'method_name'}=? AND is_active=1`,
          [methodId]
        );

        requireThat(pm, 'REFERENCE_DATA_MISSING');

        const uploads = files ?? (file ? [file] : []);

        requireThat(
          Array.isArray(uploads) &&
          uploads.length > 0 &&
          uploads.length <= 5,
          'INVALID_DOCUMENT'
        );

        const proof = await insert(
          c,
          'INSERT INTO proof_of_payment(invoice_id,client_user_id,payment_method_id,amount_declared,note) VALUES (?,?,?,?,?)',
          [
            invoiceId,
            a.userId,
            pm.id,
            format(value, 2),
            note ?? referenceNumber ?? null
          ]
        );

        const documents = [];

        for (const upload of uploads) {
          const doc = await store(
            c,
            a,
            upload,
            'paymentProof',
            'payment-proofs',
            proof,
            staged
          );

          await rows(
            c,
            'INSERT INTO proof_of_payment_file(receipt_id,document_id) VALUES (?,?)',
            [proof, doc]
          );

          documents.push(doc);
        }

        await audit(
          c,
          a,
          'payment.proof_submitted',
          'proof_of_payment',
          proof,
          null,
          {
            invoiceId,
            amount: format(value, 2),
            documentIds: documents
          }
        );

        return ok({
          id: proof,
          paymentId: proof,
          verificationStatus: 'pending',
          fileIds: documents
        });
      }
    ),

    paymentQueue: (query = {}) => read(db, async c => {
      object(query, ['status', 'limit', 'pageSize']);

      const { pageSize } = paging({
        ...query,
        limit: query.limit ?? '100'
      });

      requireThat(
        query.status === undefined ||
        ['all', 'pending', 'verified', 'rejected'].includes(query.status)
      );

      const filter =
        query.status && query.status !== 'all'
          ? ' AND r.review_status=?'
          : '';

      const params = filter ? [query.status] : [];

      return ok(await rows(
        c,
        `SELECT CAST(r.receipt_id AS CHAR) id,CAST(r.invoice_id AS CHAR) invoiceId,CAST(q.inquiry_id AS CHAR) orderId,r.amount_declared submittedAmount,r.review_status verificationStatus,r.review_note rejectionReason,r.sent_at submittedAt,q.downpayment_amount requiredDownpayment,(SELECT CAST(MIN(f.document_id) AS CHAR) FROM proof_of_payment_file f JOIN document d ON d.document_id=f.document_id AND d.storage_status='available' WHERE f.receipt_id=r.receipt_id) fileId FROM proof_of_payment r JOIN sales_invoice v ON v.invoice_id=r.invoice_id JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE 1=1${filter} ORDER BY r.sent_at DESC,r.receipt_id DESC LIMIT ?`,
        [...params, String(pageSize)]
      ));
    }),

    reviewPayment: ({
      paymentId,
      actorId,
      actor,
      decision,
      reason,
      operationKey
    }) => createAccountingService({
      db
    }).reviewProof({
      paymentId,
      actor: actor ?? {
        userId: actorId,
        roleCode: 'accounting',
        accountType: 'employee'
      },
      decision,
      reason,
      operationKey
    }),

    uploadDeliveryDocument: ({
      actor,
      deliveryId,
      file
    }) => withObjects(
      actor,
      ['accounting', 'logistics'],
      async (c, a, staged) => {
        requireThat(id(deliveryId));

        const parent = await one(
          c,
          'SELECT CAST(q.inquiry_id AS CHAR) id FROM delivery d JOIN job_order j ON j.jo_id=d.jo_id JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE d.delivery_id=?',
          [deliveryId]
        );

        requireThat(parent, 'NOT_FOUND');

        await lockInquiry(c, parent.id);

        if (a.roleCode === 'logistics') {
          requireThat(
            await one(
              c,
              "SELECT audit_event_id FROM audit_event WHERE subject_type='delivery' AND subject_id=? AND action='delivery.handed_off' LIMIT 1",
              [deliveryId]
            ),
            'NOT_FOUND'
          );
        }

        const doc = await store(
          c,
          a,
          file,
          'deliveryReceipt',
          'delivery-documents',
          deliveryId,
          staged
        );

        await audit(
          c,
          a,
          'delivery.document_uploaded',
          'document',
          doc,
          null,
          { deliveryId }
        );

        return ok({ id: doc });
      }
    ),

    retrieveFile: ({
      fileId,
      actor,
      paymentId,
      purchaseOrderId
    }) => read(db, async c => {
      requireThat(
        id(fileId) && Boolean(paymentId) !== Boolean(purchaseOrderId)
      );

      requireThat(id(paymentId ?? purchaseOrderId));

      const a = await authorize(
        c,
        actor,
        paymentId ? ['client', 'accounting'] : ['client', 'sales']
      );

      const join = paymentId
        ? 'JOIN proof_of_payment_file f ON f.document_id=d.document_id JOIN proof_of_payment r ON r.receipt_id=f.receipt_id JOIN sales_invoice v ON v.invoice_id=r.invoice_id JOIN purchase_order p ON p.po_id=v.po_id'
        : 'JOIN purchase_order p ON p.po_document_id=d.document_id';

      const doc = await one(
        c,
        `SELECT d.file_name originalFilename,d.mime_type mimeType,d.storage_bucket bucketName,d.storage_key objectKey,d.object_generation generation FROM document d ${join} JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE d.document_id=? AND ${paymentId ? 'r.receipt_id' : 'p.po_id'}=? AND d.storage_status='available'${a.accountType === 'client' ? ' AND i.client_id=?' : ''}`,
        [
          fileId,
          paymentId ?? purchaseOrderId,
          ...(a.accountType === 'client' ? [a.clientId] : [])
        ]
      );

      requireThat(doc, 'NOT_FOUND');

      const content = await objects.get({
        bucketName: doc.bucketName,
        objectKey: doc.objectKey,
        generation: doc.generation
      });

      return ok({
        originalFilename: doc.originalFilename,
        mimeType: doc.mimeType,
        buffer: content.buffer
      });
    })
  };

  service.sketches = ({
    orderId,
    itemId,
    fileId,
    actor
  }, content = false) => read(db, async c => {
    requireThat(
      id(orderId) && id(itemId) && (!content || id(fileId))
    );

    const a = await authorize(c, actor, ['client', 'sales']);

    const doc = await one(
      c,
      `SELECT CAST(d.document_id AS CHAR) id,d.file_name originalFilename,d.mime_type mimeType,d.size_bytes sizeBytes,d.storage_bucket bucketName,d.storage_key objectKey,d.object_generation generation FROM document d JOIN inquiry_item ii ON ii.sketch_document_id=d.document_id JOIN inquiry i ON i.inquiry_id=ii.inquiry_id WHERE i.inquiry_id=? AND ii.inquiry_item_id=? AND d.storage_status='available'${a.accountType === 'client' ? ' AND i.client_id=?' : ''}${content ? ' AND d.document_id=?' : ''}`,
      [
        orderId,
        itemId,
        ...(a.accountType === 'client' ? [a.clientId] : []),
        ...(content ? [fileId] : [])
      ]
    );

    if (!doc) return content ? fail('NOT_FOUND') : ok([]);

    if (!content) {
      return ok([{
        id: doc.id,
        originalFilename: doc.originalFilename,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes
      }]);
    }

    const obj = await objects.get({
      bucketName: doc.bucketName,
      objectKey: doc.objectKey,
      generation: doc.generation
    });

    return ok({
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      buffer: obj.buffer
    });
  });

  service.retrieveDeliveryDocument = ({
    deliveryId,
    fileId,
    actor
  }) => read(db, async c => {
    requireThat(id(deliveryId) && id(fileId));

    const a = await authorize(
      c,
      actor,
      ['client', 'accounting', 'logistics']
    );

    const record = await one(
      c,
      `SELECT d.file_name originalFilename,d.mime_type mimeType,d.storage_bucket bucketName,d.storage_key objectKey,d.object_generation generation FROM document d JOIN delivery_receipt dr ON 1=1 LEFT JOIN signed_delivery_receipt sr ON sr.delivery_receipt_id=dr.delivery_receipt_id JOIN delivery dx ON dx.delivery_id=dr.delivery_id JOIN job_order j ON j.jo_id=dx.jo_id JOIN purchase_order p ON p.po_id=j.po_id JOIN quotation q ON q.quotation_id=p.quotation_id JOIN inquiry i ON i.inquiry_id=q.inquiry_id WHERE d.document_id=? AND dx.delivery_id=? AND (dr.document_id=d.document_id OR sr.document_id=d.document_id) AND d.storage_status='available'${a.accountType === 'client' ? ' AND i.client_id=?' : ''}${a.roleCode === 'logistics' ? " AND EXISTS(SELECT 1 FROM audit_event ae WHERE ae.subject_type='delivery' AND ae.subject_id=dx.delivery_id AND ae.action='delivery.handed_off')" : ''}`,
      [
        fileId,
        deliveryId,
        ...(a.accountType === 'client' ? [a.clientId] : [])
      ]
    );

    requireThat(record, 'NOT_FOUND');

    const saved = await objects.get({
      bucketName: record.bucketName,
      objectKey: record.objectKey,
      generation: record.generation
    });

    return ok({
      originalFilename: record.originalFilename,
      mimeType: record.mimeType,
      buffer: saved.buffer
    });
  });

  return service;
}
