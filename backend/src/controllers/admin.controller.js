const errors = {
  VALIDATION_ERROR:[400,'Invalid request.'], FORBIDDEN:[403,'Only an active Admin may perform this action.'],
  NOT_FOUND:[404,'Record was not found.'], IDENTITY_CONFLICT:[409,'Employee number, company, email or username conflicts with an existing record.'],
  STALE_RECORD:[409,'This record changed. Reload it before trying again.'], PROTECTED_ACCOUNT:[403,'Other Admin accounts and your own access settings are protected.'],
  NO_PORTAL_ACCOUNT:[409,'This company has no portal account. No account was created.'],
  CONFIGURATION_ERROR:[503,'Required role configuration is unavailable.'],
  WRITE_OUTCOME_UNKNOWN:[503,'The result could not be confirmed. Refresh the record before trying again.'],
  SERVICE_UNAVAILABLE:[503,'Admin service is temporarily unavailable.']
};
export function createAdminController({ service }) {
  return operation => async (request,response) => {
    try {
      const result=await service.execute(operation,{actor:request.auth,id:request.params.id,query:request.query,body:request.body??{}},{requestId:request.requestId});
      if (result?.success===true) return response.status(operation==='createEmployee'?201:200).json({success:true,data:result.data});
      const code=Object.hasOwn(errors,result?.code)?result.code:'SERVICE_UNAVAILABLE';
      const [status,message]=errors[code];
      return response.status(status).json({success:false,code,message,...(code==='VALIDATION_ERROR'?{errors:result.errors}:{} )});
    } catch { return response.status(503).json({success:false,code:'SERVICE_UNAVAILABLE',message:errors.SERVICE_UNAVAILABLE[1]}); }
  };
}
