/**
 * Read-only adapter for authenticated Warehouse shipment detail.
 * Does not generate identifiers or establish scan verification.
 *
 * @param {import('./warehouseShipments').WarehouseShipment} shipment
 */
export function warehouseWaybillsFromShipment(shipment) {
  if (
    !shipment ||
    typeof shipment.id !== "string" ||
    !shipment.id ||
    typeof shipment.jobOrderId !== "string" ||
    !shipment.jobOrderId
  ) {
    return [];
  }

  if (!Array.isArray(shipment.waybills)) return [];

  return shipment.waybills.flatMap((waybill) => {
    if (
      !waybill ||
      typeof waybill.id !== "string" ||
      !waybill.id ||
      (waybill.shipmentId != null &&
        waybill.shipmentId !== shipment.id)
    ) {
      return [];
    }

    return [{
      shipmentId: shipment.id,
      jobOrderId: shipment.jobOrderId,
      waybillId: waybill.id,
      reference: typeof waybill.reference === "string"
        ? waybill.reference
        : null,
      qrIdentifier: typeof waybill.qrIdentifier === "string" &&
        waybill.qrIdentifier.trim()
        ? waybill.qrIdentifier
        : null,
      printedAt: typeof waybill.printedAt === "string"
        ? waybill.printedAt
        : null,
    }];
  });
}