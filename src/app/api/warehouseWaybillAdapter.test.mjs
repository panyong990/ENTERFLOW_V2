import test from "node:test";
import assert from "node:assert/strict";
import { warehouseWaybillsFromShipment } from "./warehouseWaybillAdapter.js";

const shipment = {
  id: "90071992547409931234",
  jobOrderId: "90071992547409935678",
  waybills: [{
    id: "90071992547409939999",
    reference: "WB-EXAMPLE",
    qrIdentifier: "QR-EXAMPLE",
    printedAt: "2026-11-25T01:00:00Z",
  }],
};

test("preserves backend identifiers and parent shipment association", () => {
  assert.deepEqual(warehouseWaybillsFromShipment(shipment), [{
    shipmentId: shipment.id,
    jobOrderId: shipment.jobOrderId,
    waybillId: shipment.waybills[0].id,
    reference: "WB-EXAMPLE",
    qrIdentifier: "QR-EXAMPLE",
    printedAt: "2026-11-25T01:00:00Z",
  }]);
});

test("does not invent a missing QR identifier", () => {
  const result = warehouseWaybillsFromShipment({
    ...shipment,
    waybills: [{ ...shipment.waybills[0], qrIdentifier: undefined }],
  });
  assert.equal(result[0].qrIdentifier, null);
});

test("empty or missing waybill lists produce no records", () => {
  assert.deepEqual(
    warehouseWaybillsFromShipment({ ...shipment, waybills: [] }),
    [],
  );
  assert.deepEqual(
    warehouseWaybillsFromShipment({ ...shipment, waybills: undefined }),
    [],
  );
});

test("rejects mismatched shipment association", () => {
  assert.deepEqual(warehouseWaybillsFromShipment({
    ...shipment,
    waybills: [{ ...shipment.waybills[0], shipmentId: "other" }],
  }), []);
});

test("rejects malformed identifiers without fabricating records", () => {
  assert.deepEqual(warehouseWaybillsFromShipment({
    ...shipment,
    waybills: [{ ...shipment.waybills[0], id: null }],
  }), []);
});