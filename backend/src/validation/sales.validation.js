import { validateApplicationId } from './client-applications.validation.js';
import { validateApplicationRejection } from './client-applications.validation.js';

export function validateInquiryRejection(body) {
  try {
    const input = ownData(body, ['reason', 'revision']);
    if (!input) return fail({ body: 'Only reason and revision are allowed.' });
    const reason = validateApplicationRejection({ reason: input.reason });
    if (!reason.success) return fail(reason.errors);
    if (typeof input.revision !== 'string' || !/^[a-f0-9]{64}$/.test(input.revision)) return fail({ revision: 'Reload this inquiry before rejecting it.' });
    return { success: true, data: { reason: reason.data.reason, revision: input.revision } };
  } catch { return fail({ body: 'Invalid rejection request.' }); }
}

const fail = errors => ({ success: false, code: 'VALIDATION_ERROR', errors });

function ownData(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !allowed.includes(key) || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}

export function validateSalesClientListQuery(query = {}) {
  try {
    const input = ownData(query, ['q', 'status', 'sort', 'page', 'pageSize']);
    if (!input) return fail({ query: 'Unsupported query fields.' });

    const integer = (value, fallback, max) => value === undefined
      ? fallback
      : typeof value === 'string' && /^[1-9][0-9]{0,5}$/.test(value) && Number(value) <= max
        ? Number(value)
        : null;
    const page = integer(input.page, 1, 100000);
    const pageSize = integer(input.pageSize, 25, 100);
    const q = input.q === undefined ? '' : input.q;
    const status = input.status ?? 'all';
    const sort = input.sort ?? 'name-asc';

    if (!page || !pageSize || typeof q !== 'string' || q.length > 254 || !q.isWellFormed() ||
        !['all', 'active', 'inactive'].includes(status) ||
        !['name-asc', 'name-desc', 'id-asc', 'id-desc'].includes(sort)) {
      return fail({ query: 'Invalid client directory filters or pagination.' });
    }
    return { success: true, data: { page, pageSize, q: q.trim(), status, sort } };
  } catch {
    return fail({ query: 'Valid client directory parameters are required.' });
  }
}

export function validateSalesClientId(id) {
  return validateApplicationId(id).success
    ? { success: true, data: id }
    : fail({ id: 'Invalid client identifier.' });
}

const ORDER_STAGES = ['inquiry', 'quotation', 'po', 'jo', 'in_production', 'quality_inspection', 'ready_for_dispatch', 'dispatched', 'delivered', 'paid', 'overdue'];

export function validateSalesOrderListQuery(query = {}) {
  try {
    const input = ownData(query, ['q', 'status', 'stage', 'sort', 'page', 'pageSize', 'cancellationStatus']);
    if (!input) return fail({ query: 'Unsupported query fields.' });
    const integer = (value, fallback, max) => value === undefined
      ? fallback
      : typeof value === 'string' && /^[1-9][0-9]{0,5}$/.test(value) && Number(value) <= max
        ? Number(value)
        : null;
    const page = integer(input.page, 1, 100000);
    const pageSize = integer(input.pageSize, 25, 100);
    const q = input.q === undefined ? '' : input.q;
    const status = input.status ?? 'all';
    const stage = input.stage ?? 'all';
    const sort = input.sort ?? 'submitted-desc';
    if (!page || !pageSize || typeof q !== 'string' || q.length > 254 || !q.isWellFormed() ||
        !['all', 'open', 'archived'].includes(status) ||
        !(stage === 'all' || ORDER_STAGES.includes(stage)) ||
        (input.cancellationStatus !== undefined && !['all', 'pending', 'approved', 'declined'].includes(input.cancellationStatus)) ||
        !['submitted-asc', 'submitted-desc', 'client-asc', 'client-desc', 'id-asc', 'id-desc'].includes(sort)) {
      return fail({ query: 'Invalid order filters or pagination.' });
    }
    return { success: true, data: { page, pageSize, q: q.trim(), status, stage, sort,
      ...(input.cancellationStatus === undefined ? {} : { cancellationStatus: input.cancellationStatus }) } };
  } catch {
    return fail({ query: 'Valid order directory parameters are required.' });
  }
}

export function validateSalesOrderId(id) {
  return validateApplicationId(id).success
    ? { success: true, data: id }
    : fail({ id: 'Invalid order identifier.' });
}

export function validateQuotationDecision(body) {
  try {
    const input = ownData(body, ['decision', 'reason']);
    if (!input || !['accepted', 'rejected'].includes(input.decision)) {
      return fail({ decision: 'A quotation decision must be accepted or rejected.' });
    }
    if (input.reason !== undefined && (typeof input.reason !== 'string' || input.reason.length > 1000 || !input.reason.isWellFormed())) {
      return fail({ reason: 'The decision reason is invalid.' });
    }
    const reason = input.reason?.trim() || null;
    if (input.decision === 'rejected' && !reason) return fail({ reason: 'A rejection reason is required.' });
    return { success: true, data: { decision: input.decision, reason } };
  } catch { return fail({ body: 'Invalid quotation decision request.' }); }
}

export function validatePurchaseOrderSubmission(body) {
  try {
    const input = ownData(body, ['reference','quotationId','documentId','deliveryMethodId']);
    if (!input || typeof input.reference !== 'string' || !input.reference.trim() || input.reference.length > 60 || !input.reference.isWellFormed()) {
      return fail({ reference: 'A valid purchase-order reference is required.' });
    }
    if(!validateApplicationId(input.documentId).success||!validateApplicationId(input.deliveryMethodId).success||(input.quotationId!==undefined&&!validateApplicationId(input.quotationId).success))return fail({documentId:'An available uploaded document and configured delivery method are required.'});return { success: true, data: { reference: input.reference.trim(),documentId:input.documentId,deliveryMethodId:input.deliveryMethodId,...(input.quotationId?{quotationId:input.quotationId}:{}) } };
  } catch { return fail({ body: 'Invalid purchase-order submission.' }); }
}

export function validatePurchaseOrderDecision(body) {
  try {
    const input = ownData(body, ['decision', 'reason']);
    if (!input || !['validated', 'rejected'].includes(input.decision)) return fail({ decision: 'A purchase-order decision must be validated or rejected.' });
    if (input.reason !== undefined && (typeof input.reason !== 'string' || input.reason.length > 1000 || !input.reason.isWellFormed())) return fail({ reason: 'The purchase-order decision reason is invalid.' });
    const reason = input.reason?.trim() || null;
    if (input.decision === 'rejected' && !reason) return fail({ reason: 'A rejection reason is required.' });
    return { success: true, data: { decision: input.decision, reason } };
  } catch { return fail({ body: 'Invalid purchase-order decision.' }); }
}

export function validateJobOrderCreation(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const allowed = ['productionDueDate'];
  const errors = {};
  for (const key of Object.keys(input)) if (!allowed.includes(key)) errors[key] = 'Unexpected field.';
  const dueDate = typeof input.productionDueDate === 'string' ? input.productionDueDate.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) errors.productionDueDate = 'A production due date is required.';
  else {
    const date = new Date(`${dueDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dueDate) errors.productionDueDate = 'Production due date is invalid.';
  }
  return Object.keys(errors).length ? { success: false, code: 'VALIDATION_ERROR', errors } : { success: true, data: { productionDueDate: dueDate } };
}

export function validateQuotationRevisionRequest(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};
  for (const key of Object.keys(input)) if (!['reason','quotationId'].includes(key)) errors[key] = 'Unexpected field.';
  if (input.quotationId !== undefined && !validateSalesOrderId(input.quotationId).success) errors.quotationId = 'A valid quotation ID is required.';
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 5 || reason.length > 2000) errors.reason = 'A revision reason between 5 and 2000 characters is required.';
  return Object.keys(errors).length ? { success: false, code: 'VALIDATION_ERROR', errors } : { success: true, data: { reason, ...(input.quotationId === undefined ? {} : {quotationId:input.quotationId}) } };
}

export function validateCancellationRequest(body) {
  try {
    const input = ownData(body, ['reason','termsAcknowledged','quotationId','purchaseOrderId']);
    if (!input) return fail({ body: 'Only reason and termsAcknowledged are allowed.' });
    const reason = validateApplicationRejection({ reason: input.reason });
    if (!reason.success) return fail(reason.errors);
    if (input.termsAcknowledged !== true) return fail({ termsAcknowledged: 'Acknowledge the cancellation terms before submitting.' });
    for(const key of ['quotationId','purchaseOrderId'])if(input[key]!==undefined&&!validateApplicationId(input[key]).success)return fail({[key]:'Invalid request target.'});if(input.quotationId&&input.purchaseOrderId)return fail({body:'Choose one request target.'});return {success:true,data:{reason:reason.data.reason,termsAcknowledged:true,...(input.quotationId?{quotationId:input.quotationId}:{}),...(input.purchaseOrderId?{purchaseOrderId:input.purchaseOrderId}:{})}};
  } catch { return fail({ body: 'Invalid cancellation request.' }); }
}

export function validateQuotationPreparation(body) {
  try {
    const input = ownData(body, ['status', 'reference', 'baseQuotationId', 'issuedOn', 'validUntil', 'paymentTermCode', 'timeOfDelivery', 'placeOfDelivery', 'note', 'noteHighlighted', 'downpaymentPercent', 'vatType', 'vatRate', 'includeLabor', 'applyMarkup', 'applyVat', 'discountPercent', 'costing']);
    if (!input || !Array.isArray(input.costing) || input.costing.length === 0) return fail({ body: 'Quotation costing inputs are required.' });
    if (input.baseQuotationId !== undefined && input.baseQuotationId !== null && !validateSalesOrderId(input.baseQuotationId).success) return fail({ baseQuotationId: 'Reload the latest quotation before saving.' });
    const text = (value, field, max, required = true) => {
      if (value === undefined && !required) return null;
      if (typeof value !== 'string' || !value.trim() || value.length > max || !value.isWellFormed()) throw [field, `A valid ${field} is required.`];
      return value.trim();
    };
    const decimal = (value, field, { min = 0, max = 1000000000 } = {}) => {
      if (typeof value !== 'number' && typeof value !== 'string') throw [field, `A valid ${field} is required.`];
      const normalized = typeof value === 'string' ? value.trim() : value;
      if (normalized === '' || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(String(normalized))) throw [field, `A valid ${field} is required.`];
      const number = Number(normalized);
      if (!Number.isFinite(number) || number < min || number > max) throw [field, `A valid ${field} is required.`];
      return number;
    };
    const date = (value, field) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw [field, `A valid ${field} date is required.`];
      return value;
    };
    const status = input.status ?? 'draft';
    if (!['draft', 'sent'].includes(status)) return fail({ status: 'Only draft or sent quotations can be prepared.' });
    const reference = input.reference === undefined ? null : text(input.reference, 'reference', 60);
    const issuedOn = date(input.issuedOn, 'issuedOn');
    const validUntil = date(input.validUntil, 'validUntil');
    if (validUntil < issuedOn) return fail({ validUntil: 'The validity date cannot precede the issue date.' });
    if (!['NET15', 'NET30'].includes(input.paymentTermCode)) return fail({ paymentTermCode: 'A supported payment term is required.' });
    const timeOfDelivery = text(input.timeOfDelivery, 'timeOfDelivery', 255);
    const placeOfDelivery = text(input.placeOfDelivery, 'placeOfDelivery', 2000);
    const note = input.note === undefined ? null : text(input.note, 'note', 4000, false);
    const noteHighlighted = input.noteHighlighted === undefined ? false : input.noteHighlighted;
    if (typeof noteHighlighted !== 'boolean') return fail({ noteHighlighted: 'The note highlight flag is invalid.' });
    const downpaymentPercent = decimal(input.downpaymentPercent, 'downpaymentPercent', { max: 100 });
    if (![20, 50].includes(downpaymentPercent)) return fail({ downpaymentPercent: 'Downpayment is mandatory and must be 20% or 50%.' });
    const vatType = input.vatType;
    if (!['Exclusive', 'Inclusive', 'Zero-Rated'].includes(vatType)) return fail({ vatType: 'A supported VAT type is required.' });
    const vatRate = decimal(input.vatRate, 'vatRate', { max: 100 });
    const boolean = (value, field) => { if (typeof value !== 'boolean') throw [field, `The ${field} flag is invalid.`]; return value; };
    const includeLabor = boolean(input.includeLabor, 'includeLabor');
    const applyMarkup = boolean(input.applyMarkup, 'applyMarkup');
    const applyVat = boolean(input.applyVat, 'applyVat');
    const discountPercent = input.discountPercent === undefined ? 0 : decimal(input.discountPercent, 'discountPercent', { max: 100 });
    const costing = input.costing.map((row, index) => {
      const item = ownData(row, ['orderItemId', 'laborCost', 'markupPercent']);
      if (!item) throw ['costing', `Costing line ${index + 1} is invalid.`];
      if (!validateSalesOrderId(item.orderItemId).success) throw ['costing', `Costing line ${index + 1} has an invalid order item.`];
      return { orderItemId: item.orderItemId, laborCost: decimal(item.laborCost, `costing[${index}].laborCost`), markupPercent: decimal(item.markupPercent, `costing[${index}].markupPercent`, { max: 1000 }) };
    });
    const ids = costing.map(row => row.orderItemId);
    if (new Set(ids).size !== ids.length) return fail({ costing: 'Each order item may appear only once.' });
    return { success: true, data: { status, reference, baseQuotationId: input.baseQuotationId, issuedOn, validUntil, paymentTermCode: input.paymentTermCode, timeOfDelivery, placeOfDelivery, note, noteHighlighted, downpaymentPercent, vatType, vatRate, includeLabor, applyMarkup, applyVat, discountPercent, costing } };
  } catch (error) {
    if (Array.isArray(error) && error.length === 2) return fail({ [error[0]]: error[1] });
    return fail({ body: 'Invalid quotation preparation request.' });
  }
}
