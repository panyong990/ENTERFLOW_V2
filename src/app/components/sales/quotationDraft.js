// Restore editable inputs only. Saved monetary strings stay in document history;
// the server recalculates prices for every newly saved revision.
export function restoreQuotationInputs(quotations, items) {
  const latest = [...quotations].filter(q => ['draft', 'sent', 'superseded'].includes(q.status))
    .sort((a, b) => b.revisionNumber - a.revisionNumber)[0];
  if (!latest) return { costs: {}, document: undefined, latest: undefined };
  const costs = {};
  items.forEach((item, index) => {
    const row = latest.costing?.find(cost => String(cost.orderItemId) === String(item.id));
    if (row) costs[index] = {
      laborCost: Number(row.laborCost), markupPct: Number(row.markupPercent),
      discountPct: Number(row.discountPercent), vatType: row.vatType,
      vatRate: Number(row.vatRate), includeLabor: row.includeLabor,
      applyMarkup: row.applyMarkup, applyVAT: row.applyVat,
    };
  });
  return { costs, latest, document: {
    quotationNo: latest.reference, date: latest.issuedOn ?? '', validUntil: latest.validUntil ?? '',
    lineItems: items.map((item, index) => ({
      no: index + 1, qty: item.quantity, unit: 'pcs',
      description: item.filterName || item.filterTypeCode || 'Unspecified filter type',
      unitPrice: Number.NaN,
    })),
    note: latest.note ?? '', noteHighlighted: latest.noteHighlighted,
    termsOfPayment: latest.paymentTermCode === 'NET15' ? '15-Day Terms' : '30-Day Terms',
    timeOfDelivery: latest.timeOfDelivery ?? '', placeOfDelivery: latest.placeOfDelivery ?? '',
    preparedBy: '', downpaymentPercent: Number(latest.downpaymentPercent),
  } };
}
