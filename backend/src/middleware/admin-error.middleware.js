import { json } from 'express';
export const adminJson=json({limit:'32kb'});
export function adminError(error,request,response,next) {
  if(response.headersSent) return next(error);
  const status=error.type==='entity.too.large'?413:['encoding.unsupported','charset.unsupported'].includes(error.type)?415:error.type==='entity.parse.failed'?400:503;
  response.set('Cache-Control','no-store').status(status).json({success:false,message:status===400?'Invalid JSON request body.':status===413?'Request body is too large.':status===415?'Unsupported request encoding.':'Admin service is temporarily unavailable.'});
}
