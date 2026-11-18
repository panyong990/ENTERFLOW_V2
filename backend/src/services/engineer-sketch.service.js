import { createHash, randomUUID } from 'node:crypto';
import { validateApplicationId } from '../validation/client-applications.validation.js';
import { validateClientInquiry } from '../validation/client-inquiry.validation.js';
import { createGcsDocumentStorage, validateDocumentBuffer } from '../storage/document-storage.js';
import { insertInquiry } from './client-inquiry.service.js';
import { auditRequestId } from './audit-request-id.js';

const fail = code => ({ success: false, code });
const sha = value => createHash('sha256').update(value).digest('hex');
export const validSubmissionKey = key => typeof key === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key);
const validId = id => validateApplicationId(id).success;

export function createEngineerSketchService({ db, storage, bucketName = process.env.GCS_BUCKET } = {}) {
  if (!db?.getConnection) throw new TypeError('A database pool is required.');
  // Never select storageForEnvironment: NODE_ENV=test must not change Real Mode storage.
  const objects = storage ?? createGcsDocumentStorage({ bucketName });

  async function audit(connection, userId, action, subjectType, subject, value, context) {
    const [row] = await connection.execute(
      `INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at)
       VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`,
      [userId, action, subjectType, subject, JSON.stringify(value), auditRequestId(context)]);
    if (row.affectedRows !== 1) throw new Error('Audit record could not be saved.');
  }

  // The PRIMARY KEY client row is the mutex, not the nonunique audit index.
  // Every receipt read is a current/locking read AFTER acquiring this row lock.
  async function lockOwner(connection, clientId, userId) {
    const [clients] = await connection.execute('SELECT id FROM clients WHERE id=? AND active=TRUE FOR UPDATE', [clientId]);
    if (clients.length !== 1) return false;
    const [users] = await connection.execute(
      `SELECT id FROM users WHERE id=? AND client_id=? AND active=TRUE
       AND account_type='client' AND role_code='client' FOR SHARE`, [userId, clientId]);
    return users.length === 1;
  }

  async function receipt(connection, subject) {
    const [rows] = await connection.execute(
      `SELECT new_value FROM audit_events WHERE subject_type='inquiry_submission'
       AND subject_identifier=? AND action='inquiry.submitted' ORDER BY id FOR UPDATE`, [subject]);
    if (rows.length > 1) throw new Error('Submission receipt integrity error.');
    return rows.length ? JSON.parse(rows[0].new_value) : null;
  }

  async function checkReceipt(clientId, userId, subject) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      if (!await lockOwner(connection, clientId, userId)) { await connection.rollback(); return fail('FORBIDDEN'); }
      const found = await receipt(connection, subject);
      await connection.commit();
      return { success: true, data: found };
    } catch (error) {
      try { await connection.rollback(); } catch { connection.destroy?.(); }
      throw error;
    } finally { connection.release(); }
  }

  async function journal(userId, action, attemptId, value, context) {
    const connection = await db.getConnection();
    try { await audit(connection, userId, action, 'inquiry_upload', attemptId, value, context); }
    finally { connection.release(); }
  }

  async function cleanup(staged, userId, attemptId, context) {
    const confirmed = staged.filter(file => file.generation);
    const results = await Promise.allSettled(confirmed.map(file => objects.delete({ bucketName, objectKey: file.objectKey, generation: file.generation })));
    const complete = confirmed.length === staged.length && results.every(result => result.status === 'fulfilled');
    try { await journal(userId, complete ? 'inquiry.upload_cleaned' : 'inquiry.upload_cleanup_required', attemptId, { complete }, context); }
    catch { /* The pre-upload journal remains the durable reconciliation inventory. */ }
  }

  async function submit({ clientId, userId, input, files = [], submissionKey, context = {} }) {
    if (!validId(clientId) || !validId(userId)) return fail('FORBIDDEN');
    if (!validSubmissionKey(submissionKey)) return fail('INVALID_SUBMISSION_KEY');
    const validated = validateClientInquiry(input);
    if (!validated.success) return validated;
    if (!Array.isArray(files) || files.length > validated.data.products.length) return fail('INVALID_DOCUMENT');
    const seen = new Set();
    const sketches = [];
    let totalBytes = 0;
    for (const file of files) {
      if (!file || typeof file !== 'object') return fail('INVALID_DOCUMENT');
      const line = file.lineNumber;
      if (!Number.isInteger(line) || line < 1 || line > validated.data.products.length || seen.has(line)) return fail('INVALID_DOCUMENT');
      seen.add(line);
      const checked = validateDocumentBuffer({ ...file, kind: 'sketch' });
      if (!checked.success) return checked;
      totalBytes += checked.data.sizeBytes;
      if (totalBytes > 25 * 1024 * 1024) return fail('INVALID_DOCUMENT');
      sketches.push({ ...checked.data, lineNumber: line, buffer: file.buffer, sha256: sha(file.buffer) });
    }
    sketches.sort((a, b) => a.lineNumber - b.lineNumber);
    const digest = sha(JSON.stringify({ inquiry: validated.data, sketches: sketches.map(({ lineNumber, filename, mimeType, sizeBytes, sha256 }) => ({ lineNumber, filename, mimeType, sizeBytes, sha256 })) }));
    const subject = sha(`${clientId}:${submissionKey.toLowerCase()}`);
    const existing = await checkReceipt(clientId, userId, subject);
    if (!existing.success) return existing;
    if (existing.data) return existing.data.digest === digest ? { success: true, data: existing.data.result } : fail('SUBMISSION_CONFLICT');
    if (context.signal?.aborted) return fail('SUBMISSION_ABORTED');
    if (sketches.length && (!bucketName || (!storage && process.env.GCS_STORAGE_ENABLED !== undefined && process.env.GCS_STORAGE_ENABLED !== 'true'))) return fail('STORAGE_NOT_CONFIGURED');

    const attemptId = randomUUID();
    const planned = sketches.map(file => ({ ...file, objectKey: `engineer-sketches/${attemptId}/${file.lineNumber}.${file.extension}` }));
    const staged = [];
    if (planned.length) {
      // Autocommitted internal audit inventory survives request/process failure. Never public.
      await journal(userId, 'inquiry.upload_planned', attemptId, { bucket: bucketName, objects: planned.map(file => ({ objectKey: file.objectKey, sha256: file.sha256 })) }, context);
      try {
        for (const file of planned) {
          if (context.signal?.aborted) throw Object.assign(new Error('Request aborted.'), { code: 'SUBMISSION_ABORTED' });
          // Track even an uncertain put: save may succeed before metadata retrieval fails.
          staged.push(file);
          const saved = await objects.put({ objectKey: file.objectKey, buffer: file.buffer, mimeType: file.mimeType });
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
      if (!await lockOwner(connection, clientId, userId)) { outcome = fail('FORBIDDEN'); }
      else {
        const found = await receipt(connection, subject);
        if (found) { replay = true; outcome = found.digest === digest ? { success: true, data: found.result } : fail('SUBMISSION_CONFLICT'); }
        else if (context.signal?.aborted) outcome = fail('SUBMISSION_ABORTED');
        else {
          const { result, items } = await insertInquiry(connection, clientId, userId, validated.data);
          for (const file of staged) {
            const [created] = await connection.execute(
              `INSERT INTO files (original_filename,mime_type,size_bytes,bucket,object_path,object_generation,sha256,state,uploaded_by)
               VALUES (?,?,?,?,?,?,?,'available',?)`,
              [file.filename, file.mimeType, file.sizeBytes, bucketName, file.objectKey, file.generation, file.sha256, userId]);
            if (created.affectedRows !== 1) throw new Error('File metadata could not be saved.');
            const [linked] = await connection.execute(`INSERT INTO specification_files (specification_id,file_id,purpose) VALUES (?,?,'sketch')`, [items[file.lineNumber - 1].specificationId, String(created.insertId)]);
            if (linked.affectedRows !== 1) throw new Error('Sketch link could not be saved.');
          }
          await audit(connection, userId, 'inquiry.submitted', 'inquiry_submission', subject, { digest, result, attemptId }, context);
          outcome = { success: true, data: result };
        }
      }
      if (!outcome.success || replay) { await connection.rollback(); rollbackConfirmed = true; }
      else { commitAttempted = true; await connection.commit(); committed = true; }
    } catch {
      if (!commitAttempted && connection) {
        try { await connection.rollback(); rollbackConfirmed = true; } catch { connection.destroy?.(); }
      }
      // A failed COMMIT response can mean committed. Never delete its objects.
      if (commitAttempted) connection?.destroy?.();
      outcome = fail(commitAttempted ? 'SUBMISSION_UNCONFIRMED' : 'SUBMISSION_FAILED');
    } finally { connection?.release(); }
    if (staged.length && !committed && (rollbackConfirmed || !connection)) await cleanup(staged, userId, attemptId, context);
    return outcome;
  }

  async function status({ clientId, userId, submissionKey }) {
    if (!validId(clientId) || !validId(userId)) return fail('FORBIDDEN');
    if (!validSubmissionKey(submissionKey)) return fail('INVALID_SUBMISSION_KEY');
    const checked = await checkReceipt(clientId, userId, sha(`${clientId}:${submissionKey.toLowerCase()}`));
    if (!checked.success) return checked;
    // Absence is not permission to switch keys: an upload may still be in flight.
    return { success: true, data: checked.data?.result ?? null };
  }

  async function findFiles({ orderId, itemId, fileId, actor }, content = false) {
    if (![orderId, itemId, ...(content ? [fileId] : [])].every(validId)) return fail('NOT_FOUND');
    const client = actor?.accountType === 'client' && actor.roleCode === 'client' && validId(actor.clientId);
    const sales = actor?.accountType === 'employee' && actor.roleCode === 'sales';
    if (!client && !sales) return fail('FORBIDDEN');
    const connection = await db.getConnection();
    try {
      const params = [orderId, itemId];
      if (client) params.push(actor.clientId);
      const [parents] = await connection.execute(
        `SELECT oi.id FROM orders o JOIN order_items oi ON oi.order_id=o.id AND oi.client_id=o.client_id
         JOIN product_specifications ps ON ps.id=oi.specification_id AND ps.client_id=oi.client_id
         WHERE o.id=? AND oi.id=? ${client ? 'AND o.client_id=?' : ''}`, params);
      if (parents.length !== 1) return fail('NOT_FOUND');
      if (content) params.push(fileId);
      const [rows] = await connection.execute(
        `SELECT CAST(f.id AS CHAR) id, f.original_filename originalFilename, f.mime_type mimeType, f.size_bytes sizeBytes,
         f.bucket, f.object_path objectKey, f.object_generation generation
         FROM orders o JOIN order_items oi ON oi.order_id=o.id AND oi.client_id=o.client_id
         JOIN product_specifications ps ON ps.id=oi.specification_id AND ps.client_id=oi.client_id
         JOIN specification_files sf ON sf.specification_id=ps.id AND sf.purpose='sketch'
         JOIN files f ON f.id=sf.file_id AND f.state='available'
         WHERE o.id=? AND oi.id=? ${client ? 'AND o.client_id=?' : ''} ${content ? 'AND f.id=?' : ''} ORDER BY f.id`, params);
      if (content) {
        if (rows.length !== 1) return fail('NOT_FOUND');
        const file = rows[0];
        const object = await objects.get({ bucketName: file.bucket, objectKey: file.objectKey, generation: file.generation });
        return { success: true, data: { originalFilename: file.originalFilename, mimeType: file.mimeType, buffer: object.buffer } };
      }
      return { success: true, data: rows.map(({ id, originalFilename, mimeType, sizeBytes }) => ({ id, originalFilename, mimeType, sizeBytes })) };
    } finally { connection.release(); }
  }
  return { submit, status, listSketches: args => findFiles(args), retrieveSketch: args => findFiles(args, true) };
}
