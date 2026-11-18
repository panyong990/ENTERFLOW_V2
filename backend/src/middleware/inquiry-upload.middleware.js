import Busboy from 'busboy';

// Separate parser leaves existing one-document workflows unchanged.
export function createInquiryUploadMiddleware({ maxFileBytes = 10 * 1024 * 1024, maxTotalBytes = 25 * 1024 * 1024 } = {}) {
  return (req, res, next) => {
    const reject = () => { if (!res.headersSent && !res.destroyed) res.status(400).json({ success: false, code: 'INVALID_DOCUMENT', message: 'Invalid inquiry attachments or multipart payload.' }); };
    if (!req.is('multipart/form-data')) return res.status(415).json({ success: false, code: 'INVALID_DOCUMENT', message: 'Multipart form data is required.' });
    let parser;
    try { parser = Busboy({ headers: req.headers, preservePath: true, limits: { files: 50, fields: 1, parts: 52, fieldSize: 256 * 1024, fileSize: maxFileBytes + 1, headerPairs: 100 } }); }
    catch { return reject(); }
    let invalid = false;
    let raw;
    let received = 0;
    const files = [];
    const names = new Set();
    parser.on('field', (name, value, info) => {
      if (name !== 'inquiry' || raw !== undefined || info.nameTruncated || info.valueTruncated) invalid = true;
      else raw = value;
    });
    parser.on('file', (name, stream, info) => {
      const match = /^sketch:([1-9][0-9]?)$/.exec(name);
      if (!match || names.has(name)) invalid = true;
      names.add(name);
      const chunks = [];
      let fileBytes = 0;
      stream.on('limit', () => { invalid = true; });
      stream.on('error', () => { invalid = true; });
      stream.on('data', chunk => {
        received += chunk.length;
        fileBytes += chunk.length;
        if (received > maxTotalBytes || fileBytes > maxFileBytes) invalid = true;
        if (!invalid) chunks.push(chunk);
      });
      stream.on('end', () => { if (!invalid) files.push({ lineNumber: Number(match?.[1]), filename: info.filename, mimeType: info.mimeType, buffer: Buffer.concat(chunks) }); });
    });
    for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit']) parser.on(event, () => { invalid = true; });
    parser.on('error', reject);
    const aborted = () => { parser.destroy(); };
    req.once('aborted', aborted);
    parser.on('close', () => {
      req.off('aborted', aborted);
      if (req.aborted || res.headersSent) return;
      if (invalid || raw === undefined) return reject();
      let envelope;
      try { envelope = JSON.parse(raw); } catch { return reject(); }
      const declared = envelope?.sketchLines;
      if (!Array.isArray(declared) || new Set(declared).size !== declared.length || declared.length !== files.length ||
          declared.some(line => !Number.isInteger(line) || !files.some(file => file.lineNumber === line))) return reject();
      req.inquiryUpload = { input: envelope.payload, files };
      return next();
    });
    req.pipe(parser);
  };
}
