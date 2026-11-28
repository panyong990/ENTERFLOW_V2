/**
 * HTTP-to-service boundary for Warehouse Waybill scans.
 *
 * Registered by the Warehouse router with session, role, permission,
 * origin and bounded JSON middleware.
 */
import { id } from './core.js';
export function createWaybillScanHttp({ scanHandler }) {
  if (typeof scanHandler?.verifyScan !== 'function') {
    throw new TypeError('Scan handler is required.');
  }

  return async function verifyScanRequest(req) {
    const actor = req?.auth;

    if (
      actor?.accountType !== 'employee' ||
      actor?.roleCode !== 'warehouse' ||
      typeof actor?.userId !== 'string' ||
      !/^[1-9]\d*$/.test(actor.userId)
    ) {
      return { success: false, code: 'FORBIDDEN' };
    }

    const body = req?.body;

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      typeof body.scannedIdentifier !== 'string' ||
      body.scannedIdentifier.length < 1 || body.scannedIdentifier.length > 120 ||
      !id(req?.params?.id)
    ) {
      return { success: false, code: 'VALIDATION_ERROR' };
    }

    return scanHandler.verifyScan(
      actor,
      req?.params?.id,
      body.scannedIdentifier
    );
  };
}

const scanErrors = Object.freeze({
  VALIDATION_ERROR:[400,'Enter a valid shipment and QR identifier.'],
  INVALID_INPUT:[400,'Enter a valid shipment and QR identifier.'],
  NOT_MATCHED:[404,'The QR identifier does not match this shipment’s Waybill.'],
  NOT_FOUND:[404,'The shipment or Waybill was not found.'],
  NOT_PRINTED:[409,'This Waybill has not been recorded as printed.'],
  FORBIDDEN:[403,'You are not authorized to verify this Waybill.'],
  PASSWORD_CHANGE_REQUIRED:[403,'Change your initial password before continuing.'],
  CONFLICT:[409,'Another operation is in progress. Try again explicitly.'],
  WRITE_OUTCOME_UNKNOWN:[503,'Verification could not be confirmed. Submit the same identifier again to reconcile.'],
  SERVICE_UNAVAILABLE:[503,'Verification is temporarily unavailable.']
});
// The scan service returns top-level verification fields, unlike generic Phase 2
// operations. Keep its flags in the API envelope; never echo QR/actor/error objects.
export function respondWaybillScan(res,result) {
  if(result?.success===true && result.verified===true && typeof result.alreadyVerified==='boolean' &&
    id(result.waybillId) && id(result.deliveryId)) {
    return res.status(200).json({success:true,data:{verified:true,alreadyVerified:result.alreadyVerified,
      waybillId:result.waybillId,deliveryId:result.deliveryId}});
  }
  const code=Object.hasOwn(scanErrors,result?.code)?result.code:'SERVICE_UNAVAILABLE';
  const [status,message]=scanErrors[code];return res.status(status).json({success:false,code,message});
}
