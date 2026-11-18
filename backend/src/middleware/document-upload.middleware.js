import Busboy from 'busboy';

export function createDocumentUploadMiddleware({ maxBytes = 10 * 1024 * 1024 } = {}) {
  return (request, response, next) => {
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('multipart/form-data')) {
      return response.status(415).json({ success: false, code: 'INVALID_DOCUMENT', message: 'A multipart document upload is required.' });
    }
    const fields = {};
    const files = [];
    let failed = null;
    const parser = Busboy({ headers: request.headers, limits: { files: 1, fileSize: maxBytes, fields: 10, parts: 12 } });
    parser.on('field', (name, value) => { fields[name] = value; });
    parser.on('file', (name, stream, info) => {
      const chunks = [];
      let size = 0;
      stream.on('data', chunk => { size += chunk.length; if (size <= maxBytes) chunks.push(chunk); });
      stream.on('limit', () => { failed = { code: 'INVALID_DOCUMENT', message: 'The uploaded document exceeds the allowed size.' }; });
      stream.on('end', () => files.push({ fieldName: name, filename: info.filename, mimeType: info.mimeType, buffer: Buffer.concat(chunks) }));
    });
    parser.on('error', () => { failed = { code: 'INVALID_DOCUMENT', message: 'The multipart document upload could not be read.' }; });
    parser.on('finish', () => { if (failed) return response.status(400).json({ success: false, ...failed }); request.documentUpload = Object.freeze({ fields, file: files[0] ?? null }); return next(); });
    request.pipe(parser);
  };
}
