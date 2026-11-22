export const phase2Errors={
  VALIDATION_ERROR:[400,'Invalid request.'],FORBIDDEN:[403,'This action is not permitted.'],NOT_FOUND:[404,'Record was not found.'],
  PASSWORD_CHANGE_REQUIRED:[403,'Change your initial password before continuing.'],REFERENCE_DATA_MISSING:[409,'Required approved reference data is missing.'],
  CONFIGURATION_ERROR:[409,'Required reference configuration is missing.'],MATERIAL_COSTING_INCOMPLETE:[422,'Approved material quantities, units and prices are required.'],
  INVALID_STATE:[409,'The record is not eligible for this transition.'],CONFLICT:[409,'A duplicate or concurrent operation conflicts with this request.'],
  QUOTATION_NOT_ELIGIBLE:[409,'The current quotation is not eligible for this transition.'],QUOTATION_STALE:[409,'A newer quotation exists. Reload before retrying.'],
  QUOTATION_NOT_ACCEPTED:[409,'The current quotation must be accepted first.'],PURCHASE_ORDER_ALREADY_EXISTS:[409,'A purchase order already exists.'],
  PURCHASE_ORDER_NOT_VALIDATED:[409,'Sales must validate the purchase order first.'],PURCHASE_ORDER_NOT_FOUND:[404,'Purchase order was not found.'],
  PURCHASE_ORDER_ALREADY_DECIDED:[409,'The purchase order already has a decision.'],INVOICE_NOT_ISSUED:[409,'An issued invoice is required.'],
  DOWNPAYMENT_NOT_VERIFIED:[409,'Accounting must confirm the required downpayment first.'],UNIT_RECONCILIATION_REQUIRED:[409,'Existing stock must be reconciled before its unit can change.'],
  CANCELLATION_NOT_ELIGIBLE:[409,'The inquiry is no longer eligible for cancellation.'],CANCELLATION_ALREADY_DECIDED:[409,'The request already has a decision.'],
  INVALID_DOCUMENT:[400,'The uploaded document is invalid.'],DOCUMENT_UPLOAD_FAILED:[503,'The document upload could not be confirmed.'],
  STALE_RECORD:[409,'The record changed. Reload it before retrying.'],PAYMENT_ALREADY_DECIDED:[409,'The proof already has a decision.'],PAYMENT_AMOUNT_EXCEEDED:[422,'The amount exceeds the outstanding balance.'],
  WRITE_OUTCOME_UNKNOWN:[503,'The write outcome is unknown. Refresh before retrying.'],STORAGE_NOT_CONFIGURED:[503,'Document storage is not configured.'],
  SERVICE_UNAVAILABLE:[503,'The service is temporarily unavailable.'],
};
export function respondPhase2(response,result,status=200){if(result?.success)return response.status(status).json({success:true,data:result.data});const code=Object.hasOwn(phase2Errors,result?.code)?result.code:'SERVICE_UNAVAILABLE';const [http,message]=phase2Errors[code];return response.status(http).json({success:false,code,message,...(code==='VALIDATION_ERROR'&&result?.errors?{errors:result.errors}:{})});}
