function decimal(value) {
  if (value == null) return null;

  const match = /^(\d+)(?:\.(\d{1,4}))?$/.exec(
    String(value)
  );

  if (!match) return null;

  return BigInt(match[1]) * 10000n +
    BigInt((match[2] ?? '').padEnd(4, '0'));
}

export function classifyStock(
  quantity,
  quantityStatus,
  threshold,
  thresholdStatus
) {
  if (quantityStatus !== 'verified') {
    return 'unverified';
  }

  const qty = decimal(quantity);

  if (qty === null) return 'unverified';

  if (qty === 0n) return 'out-of-stock';

  if (thresholdStatus !== 'verified') {
    return 'unverified';
  }

  const minimum = decimal(threshold);

  if (minimum === null) return 'unverified';

  return qty <= minimum
    ? 'low-stock'
    : 'in-stock';
}

export function summarizeWarehouseStock(
  rawMaterials,
  finishedGoods
) {
  const lowStockAlerts = [];
  let unverifiedRawMaterialItems = 0;

  for (const item of rawMaterials) {
    const status = classifyStock(
      item.qtyInStock,
      item.quantityStatus,
      item.threshold,
      item.thresholdStatus
    );

    if (status === 'unverified') {
      unverifiedRawMaterialItems++;
      continue;
    }

    if (status === 'in-stock') continue;

    lowStockAlerts.push({
      id: String(item.id),
      name: item.name,
      current: String(item.qtyInStock),
      minimum: item.thresholdStatus === 'verified'
        && decimal(item.threshold) !== null
        ? String(item.threshold)
        : null,
      unit: item.unit,
      status
    });
  }

  let verifiedFinishedGoodsQuantity = 0n;
  let unverifiedFinishedGoodsItems = 0;

  for (const item of finishedGoods) {
    const qty = decimal(item.qtyInStock);

    if (
      item.quantityStatus !== 'verified' ||
      qty === null ||
      qty % 10000n !== 0n
    ) {
      unverifiedFinishedGoodsItems++;
      continue;
    }

    verifiedFinishedGoodsQuantity += qty / 10000n;
  }

  return {
    trackedRawMaterialItems: rawMaterials.length,

    finishedGoods: {
      recordedItems: finishedGoods.length,
      totalQuantity: unverifiedFinishedGoodsItems === 0
        ? verifiedFinishedGoodsQuantity.toString()
        : null,
      verifiedQuantity:
        verifiedFinishedGoodsQuantity.toString(),
      unverifiedItems: unverifiedFinishedGoodsItems,
      complete: unverifiedFinishedGoodsItems === 0
    },

    lowStock: {
      confirmedItems: lowStockAlerts.length,
      unverifiedItems: unverifiedRawMaterialItems,
      complete: unverifiedRawMaterialItems === 0
    },

    lowStockAlerts
  };
}
