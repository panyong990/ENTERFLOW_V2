import Busboy from 'busboy';

export function createDocumentUploadMiddleware({ maxBytes = 10 * 1024 * 1024, multiple = false } = {}) {
  return (request, response, next) => {
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('multipart/form-data')) {
      return response.status(415).json({ success: false, code: 'INVALID_DOCUMENT', message: 'A multipart document upload is required.' });
    }
    const fields = {};
    const files = [];
    let failed = null;
    let parser,total=0;
    try {parser = Busboy({ headers: request.headers, limits: { files: multiple?5:1, fileSize: maxBytes, fields: 10, fieldSize:8192, parts: multiple?16:12 } });}
    catch{return response.status(400).json({success:false,code:'INVALID_DOCUMENT',message:'Invalid multipart upload.'});}
    parser.on('field', (name, value,info) => { if(Object.hasOwn(fields,name)||info.valueTruncated||!['reference','invoiceId','amount','method','paymentMethodId','referenceNumber','note','deliveryMethodId','quotationId'].includes(name))failed={code:'INVALID_DOCUMENT',message:'Invalid upload fields.'};else fields[name] = value; });
    parser.on('file', (name, stream, info) => {
      const chunks = [];
      let size = 0;
      stream.on('data', chunk => { size += chunk.length;total+=chunk.length;if(total>25*1024*1024)failed={code:'INVALID_DOCUMENT',message:'Upload exceeds total size limit.'};if (size <= maxBytes&&!failed) chunks.push(chunk); });
      stream.on('limit', () => { failed = { code: 'INVALID_DOCUMENT', message: 'The uploaded document exceeds the allowed size.' }; });
      stream.on('end', () => files.push({ fieldName: name, filename: info.filename, mimeType: info.mimeType, buffer: Buffer.concat(chunks) }));
    });
    parser.on('error', () => { failed = { code: 'INVALID_DOCUMENT', message: 'The multipart document upload could not be read.' }; });
    for(const event of ['filesLimit','fieldsLimit','partsLimit'])parser.on(event,()=>{failed={code:'INVALID_DOCUMENT',message:'Upload limits exceeded.'};});
    parser.on('close', () => { if(response.headersSent||request.aborted)return;if (failed||files.length===0) return response.status(400).json({ success: false, ...(failed??{code:'INVALID_DOCUMENT',message:'Document is required.'}) }); request.documentUpload = Object.freeze({ fields, file: files[0] ?? null,files }); return next(); });
    request.pipe(parser);
  };
}
