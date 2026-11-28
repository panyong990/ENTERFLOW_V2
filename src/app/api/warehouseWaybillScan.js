const validId=value=>typeof value==='string' && /^[1-9]\d{0,19}$/.test(value) && BigInt(value)<=18446744073709551615n;
export function scanRequest(deliveryId,scannedIdentifier) {
  if(!validId(deliveryId) || typeof scannedIdentifier!=='string' || scannedIdentifier.length<1 || scannedIdentifier.length>120)
    throw new Error('Enter a valid shipment and QR identifier.');
  return {path:`/api/warehouse/shipments/${encodeURIComponent(deliveryId)}/waybill/scan`,body:{scannedIdentifier}};
}
export function scanResponse(value,deliveryId) {
  if(!value || value.verified!==true || typeof value.alreadyVerified!=='boolean' || !validId(value.waybillId) || value.deliveryId!==deliveryId)
    throw new Error('Verification response could not be confirmed. Retry the same identifier explicitly to reconcile.');
  return {verified:true,alreadyVerified:value.alreadyVerified,waybillId:value.waybillId,deliveryId};
}
export function scanFailureMessage(error) {
  const messages={
    NOT_MATCHED:'Invalid QR identifier for this shipment.',NOT_FOUND:'Shipment or Waybill not found.',
    NOT_PRINTED:'This Waybill has not been recorded as printed.',
    RATE_LIMITED:'Too many verification attempts. Please wait briefly before trying again.',
    FORBIDDEN:'You are not authorized to verify this Waybill.',
    PASSWORD_CHANGE_REQUIRED:'Change your initial password before continuing.',
    VALIDATION_ERROR:'Enter a valid shipment and QR identifier.',INVALID_INPUT:'Enter a valid shipment and QR identifier.',
    CONFLICT:'Another operation is in progress. Try again explicitly.',
    WRITE_OUTCOME_UNKNOWN:'Verification outcome is unknown. Retry the same identifier explicitly to reconcile.',
    NETWORK_ERROR:'Verification could not be confirmed. Retry the same identifier explicitly to reconcile.',
    INVALID_RESPONSE:'Verification response could not be confirmed. Retry the same identifier explicitly to reconcile.'
  };
  if(error?.status===401)return 'Your session has expired. Sign in again.';
  if(messages[error?.code])return messages[error.code];
  if(error?.status===403)return messages.FORBIDDEN;
  return 'Verification could not be confirmed. Retry the same identifier explicitly to reconcile.';
}
