import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_EXTENSIONS = Object.freeze({
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png'
});

export const DOCUMENT_LIMITS = Object.freeze({
  po: 10 * 1024 * 1024,
  paymentProof: 10 * 1024 * 1024,
  sketch: 10 * 1024 * 1024
  ,deliveryReceipt: 10 * 1024 * 1024
});

export function extensionForMime(mimeType) {
  return MIME_EXTENSIONS[mimeType] ?? null;
}

export function validateDocumentBuffer({ buffer, filename, mimeType, kind }) {
  const limit = DOCUMENT_LIMITS[kind];
  const extension = typeof filename === 'string' ? filename.toLowerCase().split('.').pop() : '';
  const expected = extensionForMime(mimeType);
  if (kind === 'sketch' && (typeof filename !== 'string' || filename.length > 255 || !filename.trim() || /[\x00-\x1f\x7f/\\]/.test(filename) || filename.startsWith('.'))) {
    return { success: false, code: 'INVALID_DOCUMENT', message: 'A valid document filename is required.' };
  }
  if (!limit || !Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > limit) {
    return { success: false, code: 'INVALID_DOCUMENT', message: 'The document is empty or exceeds the allowed size.' };
  }
  if (!expected || (extension !== expected && !(kind === 'sketch' && mimeType === 'image/jpeg' && extension === 'jpeg'))) return { success: false, code: 'INVALID_DOCUMENT', message: 'Only PDF, JPG, and PNG documents are supported.' };
  const signature = buffer.subarray(0, 8);
  const validSignature = mimeType === 'application/pdf'
    ? signature.toString('ascii', 0, 5) === '%PDF-'
    : mimeType === 'image/jpeg'
      ? signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
      : signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4e && signature[3] === 0x47 && signature[4] === 0x0d && signature[5] === 0x0a && signature[6] === 0x1a && signature[7] === 0x0a;
  if (!validSignature) return { success: false, code: 'INVALID_DOCUMENT', message: 'The uploaded file content does not match its declared type.' };
  return { success: true, data: { filename: filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 255), mimeType, sizeBytes: buffer.length, extension: expected } };
}

export function createMockDocumentStorage() {
  const objects = new Map();
  return {
    async put({ objectKey, buffer, mimeType }) { objects.set(objectKey, { buffer: Buffer.from(buffer), mimeType }); return { generation: 'mock-1', sha256: null }; },
    async get({ objectKey }) { const object = objects.get(objectKey); if (!object) { const error = new Error('Object not found.'); error.code = 'NOT_FOUND'; throw error; } return object; },
    async delete({ objectKey }) { objects.delete(objectKey); },
    has(objectKey) { return objects.has(objectKey); }
  };
}

export function createLocalDocumentStorage({
  rootDir = process.env.DOCUMENT_STORAGE_LOCAL_DIR
} = {}) {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const baseDir = path.resolve(
    rootDir || path.resolve(moduleDir, '../../storage/documents')
  );

  function resolveObject(objectKey) {
    if (
      typeof objectKey !== 'string' ||
      !objectKey ||
      objectKey.includes('\\') ||
      objectKey.split('/').some(part =>
        !part || part === '.' || part === '..'
      )
    ) {
      throw new Error('Invalid document storage key.');
    }

    const target = path.resolve(baseDir, objectKey);
    const relative = path.relative(baseDir, target);

    if (
      relative.startsWith('..') ||
      path.isAbsolute(relative)
    ) {
      throw new Error('Invalid document storage path.');
    }

    return target;
  }

  return {
    async put({ objectKey, buffer, mimeType }) {
      const target = resolveObject(objectKey);
      const metadataPath = `${target}.metadata.json`;
      const generation = randomUUID();

      await mkdir(path.dirname(target), { recursive: true });

      try {
        await writeFile(target, buffer, { flag: 'wx' });
        await writeFile(
          metadataPath,
          JSON.stringify({ generation, mimeType }),
          { flag: 'wx' }
        );
      } catch (error) {
        await unlink(target).catch(() => {});
        throw error;
      }

      return { generation, sha256: null };
    },

    async get({ objectKey, generation }) {
      const target = resolveObject(objectKey);
      const metadataPath = `${target}.metadata.json`;

      const metadata = JSON.parse(
        await readFile(metadataPath, 'utf8')
      );

      if (generation && metadata.generation !== String(generation)) {
        throw Object.assign(new Error('Document version not found.'), {
          code: 'NOT_FOUND'
        });
      }

      return {
        buffer: await readFile(target),
        mimeType: metadata.mimeType,
        generation: metadata.generation
      };
    },

    async delete({ objectKey, generation }) {
      const target = resolveObject(objectKey);
      const metadataPath = `${target}.metadata.json`;

      try {
        const metadata = JSON.parse(
          await readFile(metadataPath, 'utf8')
        );

        if (generation && metadata.generation !== String(generation)) {
          return;
        }

        await unlink(target).catch(error => {
          if (error.code !== 'ENOENT') throw error;
        });

        await unlink(metadataPath).catch(error => {
          if (error.code !== 'ENOENT') throw error;
        });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  };
}

export function createGcsDocumentStorage({ bucketName = process.env.GCS_BUCKET, projectId = process.env.GOOGLE_CLOUD_PROJECT, client } = {}) {
  if (!bucketName || (process.env.GCS_STORAGE_ENABLED !== undefined && process.env.GCS_STORAGE_ENABLED !== 'true')) {
    return { async put() { throw Object.assign(new Error('Document storage is not configured.'), { code: 'STORAGE_NOT_CONFIGURED' }); }, async get() { throw Object.assign(new Error('Document storage is not configured.'), { code: 'STORAGE_NOT_CONFIGURED' }); }, async delete() { throw Object.assign(new Error('Document storage is not configured.'), { code: 'STORAGE_NOT_CONFIGURED' }); } };
  }
  const storage = client ?? new Storage({ projectId: projectId || undefined });
  const bucket = storage.bucket(bucketName);
  return {
    async put({ objectKey, buffer, mimeType }) {
      const file = bucket.file(objectKey);
      await file.save(buffer, { resumable: false, contentType: mimeType, validation: 'md5', preconditionOpts: { ifGenerationMatch: 0 } });
      const [metadata] = await file.getMetadata();
      return { generation: metadata.generation ?? null, sha256: null };
    },
    async get({ objectKey, bucketName: recordedBucket = bucketName, generation }) { const file = storage.bucket(recordedBucket).file(objectKey, generation ? { generation } : undefined); const [buffer] = await file.download(); const [metadata] = await file.getMetadata(); return { buffer, mimeType: metadata.contentType ?? 'application/octet-stream', generation: metadata.generation ?? null }; },
    async delete({ objectKey, bucketName: recordedBucket = bucketName, generation }) { await storage.bucket(recordedBucket).file(objectKey).delete({ ignoreNotFound: true, ...(generation ? { ifGenerationMatch: generation } : {}) }); }
  };
}

export function objectKeyFor({ scope, parentId, fileId, extension }) {
  return `${scope}/${String(parentId)}/${String(fileId)}/${randomUUID()}.${extension}`;
}

export function storageForEnvironment({ storage, allowMock = false } = {}) {
  if (storage) return storage;
  if (allowMock) return createMockDocumentStorage();
  return createGcsDocumentStorage();
}
