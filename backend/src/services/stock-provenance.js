// A stored/sample number is not an operational observation. Missing or invalid
// provenance fails closed; callers retain raw values separately for maintenance.
export function operationalStockQuantity(value, status) {
  if (status !== 'verified' || !['number', 'string'].includes(typeof value)
    || !/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(String(value))) return null;
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity >= 0 ? quantity : null;
}
