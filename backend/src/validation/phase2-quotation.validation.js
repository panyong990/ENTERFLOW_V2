import { object, id, requireThat, text, date, paymentTerm, decimal } from '../phase2/core.js';
export function validatePhase2Quotation(input) {
  try {
    object(input, ['status', 'reference', 'baseQuotationId', 'issuedOn', 'validUntil', 'paymentTermCode', 'timeOfDelivery', 'placeOfDelivery', 'note', 'noteHighlighted', 'downpaymentPercent', 'vatType', 'vatRate', 'includeLabor', 'applyMarkup', 'applyVat', 'discountPercent', 'costing']);
    requireThat(['draft', 'sent'].includes(input.status));
    requireThat(input.baseQuotationId == null || id(input.baseQuotationId));
    if (input.reference != null) text(input.reference, 45);
    date(input.issuedOn);
    date(input.validUntil);
    requireThat(input.validUntil >= input.issuedOn);
    paymentTerm(input.paymentTermCode);
    text(input.timeOfDelivery, 255);
    text(input.placeOfDelivery, 2000);
    if (input.note != null) text(input.note, 4000, false);
    requireThat(input.noteHighlighted === undefined || typeof input.noteHighlighted === 'boolean');
    requireThat([20, 50].includes(Number(input.downpaymentPercent)));
    requireThat(['Exclusive', 'Inclusive', 'Zero-Rated'].includes(input.vatType));
    for (const key of ['includeLabor', 'applyMarkup', 'applyVat']) requireThat(typeof input[key] === 'boolean');
    requireThat(decimal(input.vatRate) <= 1000000n && decimal(input.discountPercent ?? 0) <= 1000000n);
    requireThat(Array.isArray(input.costing) && input.costing.length > 0 && input.costing.length <= 50);
    const seen = new Set();
    for (const row of input.costing) {
      object(row, ['orderItemId', 'uomId', 'laborCost', 'markupPercent', 'materials']);
      requireThat(id(row.orderItemId) && id(row.uomId) && !seen.has(row.orderItemId));
      seen.add(row.orderItemId);
      requireThat(decimal(row.laborCost) <= 999999999999999n && decimal(row.markupPercent) <= 10000000n);
      requireThat(Array.isArray(row.materials) && row.materials.length > 0 && row.materials.length <= 100);
      const materials = new Set();
      for (const m of row.materials) {
        object(m, ['rawMaterialId', 'qtyPerFilter', 'uomId']);
        requireThat(id(m.rawMaterialId) && !materials.has(m.rawMaterialId) && (!m.uomId || id(m.uomId)));
        materials.add(m.rawMaterialId);
        const qty = decimal(m.qtyPerFilter);
        requireThat(qty > 0n && qty <= 999999999999999n);
      }
    }
    return {
      success: true,
      data: {
        ...input,
        baseQuotationId: input.baseQuotationId ?? null,
        downpaymentPercent: Number(input.downpaymentPercent)
      }
    };
  } catch {
    return {
      success: false,
      code: 'VALIDATION_ERROR',
      errors: {
        body: 'Valid quotation fields, configured units and explicit material quantities are required.'
      }
    };
  }
}
