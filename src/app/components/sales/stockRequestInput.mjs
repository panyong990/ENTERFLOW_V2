// Existing API limits; identifiers stay strings and unavailable stock is never inferred.
export function stockRequestReady({ orders, materials, orderId, materialId, quantity, loading, error, submitting }) {
  return !loading && !error && !submitting
    && orders.some(order => order.id === orderId)
    && materials.some(material => material.source === 'database' && material.databaseId === materialId)
    && /^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(quantity)
    && Number(quantity) > 0 && Number(quantity) <= 1000000000;
}
