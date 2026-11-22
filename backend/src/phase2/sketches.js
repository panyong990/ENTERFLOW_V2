import { createHash, randomUUID } from 'node:crypto';
import { validateApplicationId } from '../validation/client-applications.validation.js';
import { validateClientInquiry } from '../validation/client-inquiry.validation.js';
import { createLocalDocumentStorage, createGcsDocumentStorage, validateDocumentBuffer } from '../storage/document-storage.js';
import { insertInquiry } from './workflows.js';
import { auditRequestId } from '../services/audit-request-id.js';
import { authorize } from './core.js';
import { createDocumentWorkflowsService } from './documents.js';
const fail = code => ({
  success: false,
  code
});
const sha = value => createHash('sha256').update(value).digest('hex');
export const validSubmissionKey = key => typeof key === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key);
const validId = id => validateApplicationId(id).success;
export function createEngineerSketchService({
  db,
  storage,
  bucketName = process.env.GCS_BUCKET,
  storageDriver = process.env.DOCUMENT_STORAGE_DRIVER || 'gcs'
} = {}) {
  if (!db?.getConnection) throw new TypeError('A database pool is required.');

const objects = storage ?? (
  storageDriver === 'local'
    ? createLocalDocumentStorage()
    : storageDriver === 'gcs'
      ? createGcsDocumentStorage({ bucketName })
      : (() => {
          throw new Error(`Unsupported document storage driver: ${storageDriver}`);
        })()
);
  async function audit(connection, userId, action, subjectType, subject, value, context) {
    const [row] = await connection.execute(`INSERT INTO audit_event(actor_user_id,action,subject_type,subject_id,after_value,occurred_at)
       VALUES (?,?,?,?,?,UTC_TIMESTAMP(3))`, [userId, action, subjectType, value.result?.id ?? userId, JSON.stringify({
      ...value,
      submissionSubject: subject,
      requestId: auditRequestId(context)
    })]);
    if (row.affectedRows !== 1) throw new Error('Audit record could not be saved.');
  }
  async function lockOwner(connection, clientId, userId) {
    // Keep user -> client lock ordering consistent with account administration.
    // Take the explicit locks before authorize's shared joins, avoiding a
    // shared-to-exclusive client lock upgrade between concurrent submissions.
    const [users]=await connection.execute('SELECT user_id FROM user_account WHERE user_id=? FOR UPDATE',[userId]);
    if(users.length!==1)return false;
    const [clients] = await connection.execute("SELECT client_id FROM client WHERE client_id=? AND status='active' FOR UPDATE", [clientId]);
    if (clients.length !== 1) return false;
    try {
      await authorize(connection, {
        userId,
        clientId,
        roleCode: 'client',
        accountType: 'client'
      }, ['client']);
      return true;
    } catch {
      return false;
    }
  }
  async function receipt(connection, subject) {
    const [rows] = await connection.execute(`SELECT after_value new_value FROM audit_event WHERE subject_type='inquiry_submission'
      AND action='inquiry.submitted' AND JSON_UNQUOTE(JSON_EXTRACT(after_value,'$.submissionSubject'))=? ORDER BY audit_event_id FOR UPDATE`, [subject]);
    if (rows.length > 1) throw new Error('Submission receipt integrity error.');
    return rows.length ? typeof rows[0].new_value === 'string' ? JSON.parse(rows[0].new_value) : rows[0].new_value : null;
  }
  async function checkReceipt(clientId, userId, subject) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      if (!(await lockOwner(connection, clientId, userId))) {
        await connection.rollback();
        return fail('FORBIDDEN');
      }
      const found = await receipt(connection, subject);
      await connection.commit();
      return {
        success: true,
        data: found
      };
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        connection.destroy?.();
      }
      throw error;
    } finally {
      connection.release();
    }
  }
  async function journal(userId, action, attemptId, value, context) {
    const connection = await db.getConnection();
    try {
      await audit(connection, userId, action, 'inquiry_upload', attemptId, value, context);
    } finally {
      connection.release();
    }
  }
    async function cleanup(staged, userId, attemptId, context) {
    const storageBucket = storageDriver === 'local' ? 'local' : bucketName;
    const confirmed = staged.filter(file => file.generation);

    const results = await Promise.allSettled(
      confirmed.map(file => objects.delete({
        bucketName: storageBucket,
        objectKey: file.objectKey,
        generation: file.generation
      }))
    );

    const complete =
      confirmed.length === staged.length &&
      results.every(result => result.status === 'fulfilled');

    try {
      await journal(
        userId,
        complete ? 'inquiry.upload_cleaned' : 'inquiry.upload_cleanup_required',
        attemptId,
        {
          complete,
          bucket: storageBucket
        },
        context
      );
    } catch {
      // The pre-upload journal remains the durable reconciliation inventory.
    }
  }
  async function submit({
    clientId,
    userId,
    input,
    files = [],
    submissionKey,
    context = {}
  }) {
    if (!validId(clientId) || !validId(userId)) return fail('FORBIDDEN');
    if (!validSubmissionKey(submissionKey)) return fail('INVALID_SUBMISSION_KEY');
    const validated = validateClientInquiry(input);
    if (!validated.success) return validated;
    if (!Array.isArray(files) || files.length !== validated.data.products.length) {
  return fail('INVALID_DOCUMENT');
}
    const seen = new Set();
    const sketches = [];
    let totalBytes = 0;
    for (const file of files) {
      if (!file || typeof file !== 'object') return fail('INVALID_DOCUMENT');
      const line = file.lineNumber;
      if (!Number.isInteger(line) || line < 1 || line > validated.data.products.length || seen.has(line)) return fail('INVALID_DOCUMENT');
      seen.add(line);
      const checked = validateDocumentBuffer({
        ...file,
        kind: 'sketch'
      });
      if (!checked.success) return checked;
      totalBytes += checked.data.sizeBytes;
      if (totalBytes > 25 * 1024 * 1024) return fail('INVALID_DOCUMENT');
      sketches.push({
        ...checked.data,
        lineNumber: line,
        buffer: file.buffer,
        sha256: sha(file.buffer)
      });
    }
    sketches.sort((a, b) => a.lineNumber - b.lineNumber);
    const digest = sha(JSON.stringify({
      inquiry: validated.data,
      sketches: sketches.map(({
        lineNumber,
        filename,
        mimeType,
        sizeBytes,
        sha256
      }) => ({
        lineNumber,
        filename,
        mimeType,
        sizeBytes,
        sha256
      }))
    }));
    const subject = sha(`${clientId}:${submissionKey.toLowerCase()}`);
    const existing = await checkReceipt(clientId, userId, subject);
    if (!existing.success) return existing;
    if (existing.data) return existing.data.digest === digest ? {
      success: true,
      data: existing.data.result
    } : fail('SUBMISSION_CONFLICT');
    if (context.signal?.aborted) return fail('SUBMISSION_ABORTED');
    if (sketches.length && !['local', 'gcs'].includes(storageDriver)) {
  return fail('STORAGE_NOT_CONFIGURED');
}
if (storageDriver === 'gcs' && sketches.length && !bucketName) {
  return fail('STORAGE_NOT_CONFIGURED');
}
    const attemptId = randomUUID();
    const planned = sketches.map(file => ({
      ...file,
      objectKey: `engineer-sketches/${attemptId}/${file.lineNumber}.${file.extension}`
    }));
    const staged = [];
    if (planned.length) {
      // Autocommitted internal audit inventory survives request/process failure. Never public.
      await journal(userId, 'inquiry.upload_planned', attemptId, {
        bucket: storageDriver === 'local' ? 'local' : bucketName,
        objects: planned.map(file => ({
          objectKey: file.objectKey,
          sha256: file.sha256
        }))
      }, context);
      try {
        for (const file of planned) {
          if (context.signal?.aborted) throw Object.assign(new Error('Request aborted.'), {
            code: 'SUBMISSION_ABORTED'
          });
          // Track even an uncertain put: save may succeed before metadata retrieval fails.
          staged.push(file);
          const saved = await objects.put({
            objectKey: file.objectKey,
            buffer: file.buffer,
            mimeType: file.mimeType
          });
          if (!saved.generation) throw new Error('Storage did not confirm an object generation.');
          file.generation = String(saved.generation);
        }
      } catch (error) {
        await cleanup(staged, userId, attemptId, context);
        return fail(['STORAGE_NOT_CONFIGURED', 'SUBMISSION_ABORTED'].includes(error.code) ? error.code : 'DOCUMENT_UPLOAD_FAILED');
      }
    }
    let connection;
    let commitAttempted = false;
    let committed = false;
    let rollbackConfirmed = false;
    let replay = false;
    let outcome;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();
      if (!(await lockOwner(connection, clientId, userId))) {
        outcome = fail('FORBIDDEN');
      } else {
        const found = await receipt(connection, subject);
        if (found) {
          replay = true;
          outcome = found.digest === digest ? {
            success: true,
            data: found.result
          } : fail('SUBMISSION_CONFLICT');
        } else if (context.signal?.aborted) outcome = fail('SUBMISSION_ABORTED');else {
          const {
            result,
            items
          } = await insertInquiry(connection, clientId, userId, validated.data);
          for (const file of staged) {
            const [created] = await connection.execute(
  `INSERT INTO document
   (file_name,mime_type,size_bytes,storage_bucket,storage_key,object_generation,sha256,storage_status,uploaded_by_user_id)
   VALUES (?,?,?,?,?,?,?,'available',?)`,
  [
    file.filename,
    file.mimeType,
    file.sizeBytes,
    storageDriver === 'local' ? 'local' : bucketName,
    file.objectKey,
    file.generation,
    file.sha256,
    userId
  ]
);
            if (created.affectedRows !== 1) throw new Error('File metadata could not be saved.');
            const [linked] = await connection.execute(`UPDATE inquiry_item SET sketch_document_id=? WHERE inquiry_item_id=?`, [String(created.insertId), items[file.lineNumber - 1].id]);
            if (linked.affectedRows !== 1) throw new Error('Sketch link could not be saved.');
          }
          await audit(connection, userId, 'inquiry.submitted', 'inquiry_submission', subject, {
            digest,
            result,
            attemptId
          }, context);
          outcome = {
            success: true,
            data: result
          };
        }
      }
      if (!outcome.success || replay) {
        await connection.rollback();
        rollbackConfirmed = true;
      } else {
        commitAttempted = true;
        await connection.commit();
        committed = true;
      }
        } catch (error) {
      console.error('[ENGINEER SKETCH SUBMISSION ERROR]', {
        code: error?.code,
        message: error?.message,
        stack: error?.stack
      });

      if (!commitAttempted && connection) {
        try {
          await connection.rollback();
          rollbackConfirmed = true;
        } catch {
          connection.destroy?.();
        }
      }
      // A failed COMMIT response can mean committed. Never delete its objects.
      if (commitAttempted) connection?.destroy?.();
      outcome = fail(commitAttempted ? 'SUBMISSION_UNCONFIRMED' : 'SUBMISSION_FAILED');
    } finally {
      connection?.release();
    }
    if (staged.length && !committed && (rollbackConfirmed || !connection)) await cleanup(staged, userId, attemptId, context);
    return outcome;
  }
  async function status({
    clientId,
    userId,
    submissionKey
  }) {
    if (!validId(clientId) || !validId(userId)) return fail('FORBIDDEN');
    if (!validSubmissionKey(submissionKey)) return fail('INVALID_SUBMISSION_KEY');
    const checked = await checkReceipt(clientId, userId, sha(`${clientId}:${submissionKey.toLowerCase()}`));
    if (!checked.success) return checked;
    // Absence is not permission to switch keys: an upload may still be in flight.
    return {
      success: true,
      data: checked.data?.result ?? null
    };
  }
  const documents = createDocumentWorkflowsService({
    db,
    storage,
    bucketName
  });
  return {
    submit,
    status,
    listSketches: args => documents.sketches(args),
    retrieveSketch: args => documents.sketches(args, true)
  };
}
