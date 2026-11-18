import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_INQUIRY_PRODUCTS,
  MAX_SKETCH_FILE_BYTES,
  MAX_SKETCH_TOTAL_BYTES,
  validateClientInquiryDraft,
  validateInquirySketchFile,
} from "./inquiryValidation.mjs";

const product = (overrides = {}) => ({
  type: "AIRFIL",
  filterName: "Synthetic Filter",
  quantity: 10,
  specifications: { od1: "100", media: "Microglass" },
  ...overrides,
});

const inquiry = (overrides = {}) => ({
  contactPerson: "Synthetic Contact",
  paymentTermCode: "NET30",
  requestedDeliveryDate: null,
  generalNotes: null,
  products: [product()],
  ...overrides,
});

test("Client inquiry validation accepts the established contract limits", () => {
  assert.equal(validateClientInquiryDraft(inquiry({
    contactPerson: "C".repeat(160),
    products: [product({ filterName: "F".repeat(200), quantity: 1_000_000 })],
  })), null);
});

test("Client inquiry validation rejects oversized fields, quantities, and product lists before submission", () => {
  assert.match(validateClientInquiryDraft(inquiry({ contactPerson: "C".repeat(161) })), /160 characters/);
  assert.match(validateClientInquiryDraft(inquiry({ generalNotes: "N".repeat(5001) })), /5,000 characters/);
  assert.match(validateClientInquiryDraft(inquiry({ products: [product({ filterName: "F".repeat(201) })] })), /3–200 characters/);
  assert.match(validateClientInquiryDraft(inquiry({ products: [product({ quantity: 1_000_001 })] })), /10 to 1,000,000/);
  assert.match(validateClientInquiryDraft(inquiry({ products: [product({ specifications: { media: "M".repeat(256) } })] })), /255 characters/);
  assert.match(validateClientInquiryDraft(inquiry({ products: Array(MAX_INQUIRY_PRODUCTS + 1).fill(product()) })), /between 1 and 50/);
});

test("Sketch validation enforces supported file type, per-file size, and aggregate size", () => {
  const validPdf = { name: "filter.pdf", type: "application/pdf", size: MAX_SKETCH_FILE_BYTES };
  assert.equal(validateInquirySketchFile(validPdf), null);
  assert.match(validateInquirySketchFile({ ...validPdf, name: "filter.exe" }), /PDF, JPG, or PNG/);
  assert.match(validateInquirySketchFile({ ...validPdf, type: "image/png" }), /PDF, JPG, or PNG/);
  assert.match(validateInquirySketchFile({ ...validPdf, size: MAX_SKETCH_FILE_BYTES + 1 }), /10 MB/);
  assert.match(validateInquirySketchFile(
    { ...validPdf, size: 1 },
    [{ size: MAX_SKETCH_TOTAL_BYTES }],
  ), /25 MB/);
});
