export const MAX_INQUIRY_PRODUCTS = 50;
export const MAX_SKETCH_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_SKETCH_TOTAL_BYTES = 25 * 1024 * 1024;

const specificationLimits = {
  media: 255,
  innerCore: 255,
  outerCore: 255,
  oring: 255,
  gasket: 255,
  oem: 160,
  filtrationRating: 120,
  notes: 5000,
};

const sketchMimeTypes = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export function validateClientInquiryDraft(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "Inquiry details are invalid.";
  if (typeof input.contactPerson !== "string" || !input.contactPerson.trim()) return "Contact person is required.";
  if (input.contactPerson.trim().length > 160) return "Contact person must be 160 characters or fewer.";
  if (!["NET15", "NET30"].includes(input.paymentTermCode)) return "Select a supported payment term.";
  if (input.requestedDeliveryDate != null &&
      (typeof input.requestedDeliveryDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.requestedDeliveryDate))) {
    return "Requested delivery date must use YYYY-MM-DD format.";
  }
  if (typeof input.generalNotes === "string" && input.generalNotes.length > 5000) return "General notes must be 5,000 characters or fewer.";
  if (!Array.isArray(input.products) || input.products.length < 1 || input.products.length > MAX_INQUIRY_PRODUCTS) {
    return `Add between 1 and ${MAX_INQUIRY_PRODUCTS} products.`;
  }

  for (const [index, product] of input.products.entries()) {
    const number = index + 1;
    if (!product || typeof product !== "object") return `Product ${number} is invalid.`;
    if (typeof product.filterName !== "string" || product.filterName.trim().length < 3 || product.filterName.trim().length > 200) {
      return `Product ${number} filter name must be 3–200 characters.`;
    }
    if (!Number.isInteger(product.quantity) || product.quantity < 10 || product.quantity > 1_000_000) {
      return `Product ${number} quantity must be a whole number from 10 to 1,000,000.`;
    }
    if (!product.specifications || typeof product.specifications !== "object" || Array.isArray(product.specifications)) {
      return `Product ${number} specifications are invalid.`;
    }
    for (const [field, value] of Object.entries(product.specifications)) {
      if (value == null) continue;
      if (typeof value !== "string") return `Product ${number} specification values must be text.`;
      const max = specificationLimits[field] ?? 100;
      if (value.length > max) return `Product ${number} ${field} must be ${max} characters or fewer.`;
    }
  }
  return null;
}

export function validateInquirySketchFile(file, existingFiles = []) {
  if (!file || typeof file.name !== "string") return "Select a valid sketch file.";
  const extension = file.name.toLowerCase().split(".").pop();
  const expectedMime = sketchMimeTypes[extension];
  if (!expectedMime || (file.type && file.type !== expectedMime)) return "Sketches must be PDF, JPG, or PNG files.";
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_SKETCH_FILE_BYTES) {
    return "Each sketch must be larger than 0 bytes and no larger than 10 MB.";
  }
  const totalBytes = existingFiles.reduce((sum, existing) => sum + existing.size, file.size);
  if (totalBytes > MAX_SKETCH_TOTAL_BYTES) return "All sketches together must be no larger than 25 MB.";
  return null;
}
