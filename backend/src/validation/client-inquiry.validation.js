import {validateApplicationId} from './client-applications.validation.js';
const FILTER_TYPES = new Set([
  'OILSEP', 'WATSEP', 'SOLFIL', 'HYDFIL', 'AIRFIL', 'OILFIL', 'FUELFIL', 'COALFIL',
  'SEPFIL', 'PRIFIL', 'PREFIL', 'ACTIFIL', 'SECFIL', 'HEPFIL', 'BAGFIL', 'PADFIL'
]);

const SPEC_FIELDS = Object.freeze([
  ['od1', 'od1'], ['od2', 'od2'], ['id1', 'id1'], ['id2', 'id2'], ['height', 'height'],
  ['overallHeight', 'overall_height'], ['length', 'length'], ['width', 'width'],
  ['thickness', 'thickness'], ['depth', 'depth'], ['pocketCount', 'pocket_count'],
  ['diameter', 'diameter'], ['clothCuttingWidth', 'cloth_cutting_width'],
  ['clothCuttingLength', 'cloth_cutting_length'],
  ['springPlateCenterToCenter', 'spring_plate_center_to_center'],
  ['springPlateWidth', 'spring_plate_width'], ['springPlateLength', 'spring_plate_length'],
  ['padOd', 'pad_od'], ['padId', 'pad_id'], ['media', 'media'], ['innerCore', 'inner_core'],
  ['outerCore', 'outer_core'], ['oring', 'oring'], ['gasket', 'gasket'],
  ['endCap', 'end_cap'], ['oem', 'oem_part_number'], ['brand', 'brand'],
  ['filtrationRating', 'filtration_rating'], ['others', 'others'], ['notes', 'notes']
]);

function text(value, field, max, required = false) {
  if (typeof value !== 'string') return required ? `${field} is required.` : null;
  const normalized = value.trim();
  if (required && !normalized) return `${field} is required.`;
  if (normalized.length > max) return `${field} is too long.`;
  return null;
}

export function validateClientInquiry(input) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { success: false, code: 'VALIDATION_ERROR', errors: { body: 'A JSON object is required.' } };

  const contactError = text(input.contactPerson, 'Contact person', 160, true);
  if (contactError) errors.contactPerson = contactError;
  if (!['NET15', 'NET30'].includes(input.paymentTermCode)) errors.paymentTermCode = 'A supported payment term is required.';
  if (input.requestedDeliveryDate !== undefined && input.requestedDeliveryDate !== null &&
      (typeof input.requestedDeliveryDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.requestedDeliveryDate))) {
    errors.requestedDeliveryDate = 'Requested delivery date must use YYYY-MM-DD format.';
  }
  const notesError = text(input.generalNotes, 'General notes', 5000);
  if (notesError) errors.generalNotes = notesError;
  if (!Array.isArray(input.products) || input.products.length < 1 || input.products.length > 50) {
    errors.products = 'At least one and no more than 50 products are required.';
  } else {
    input.products.forEach((product, index) => {
      const prefix = `products[${index}]`;
      if (!product || typeof product !== 'object' || Array.isArray(product)) {
        errors[prefix] = 'A product object is required.';
        return;
      }
      if (!FILTER_TYPES.has(product.type)) errors[`${prefix}.type`] = 'Unsupported filter type.';
      if(product.filterTypeId!==undefined&&!validateApplicationId(product.filterTypeId).success)errors[`${prefix}.filterTypeId`]='A configured filter type ID is required.';
      const nameError = text(product.filterName, `${prefix}.filterName`, 200, true);
      if (nameError) errors[`${prefix}.filterName`] = nameError;
      if (!Number.isInteger(product.quantity) || product.quantity < 10 || product.quantity > 1000000) {
        errors[`${prefix}.quantity`] = 'Quantity must be a whole number from 10 to 1,000,000.';
      }
      if (!product.specifications || typeof product.specifications !== 'object' || Array.isArray(product.specifications)) {
        errors[`${prefix}.specifications`] = 'Product specifications are required.';
      } else {
        for (const [source, target] of SPEC_FIELDS) {
          const value = product.specifications[source];
          if (value !== undefined && value !== null && typeof value !== 'string') errors[`${prefix}.specifications.${source}`] = 'Specification values must be text.';
          if (typeof value === 'string' && value.length > (target === 'notes' || target === 'others' ? 5000 : target === 'media' || target === 'inner_core' || target === 'outer_core' || target === 'oring' || target === 'gasket' || target === 'end_cap' ? 255 : target === 'oem_part_number' || target === 'brand' ? 160 : target === 'filtration_rating' ? 120 : 100)) errors[`${prefix}.specifications.${source}`] = 'Specification value is too long.';
        }
      }
    });
  }
  return Object.keys(errors).length ? { success: false, code: 'VALIDATION_ERROR', errors } : {
    success: true,
    data: {
      contactPerson: input.contactPerson.trim(), paymentTermCode: input.paymentTermCode,
      requestedDeliveryDate: input.requestedDeliveryDate || null, generalNotes: input.generalNotes?.trim() || null,
      products: input.products.map(product => ({
        type: product.type, filterName: product.filterName.trim(), quantity: product.quantity,...(product.filterTypeId?{filterTypeId:product.filterTypeId}:{}),
        specifications: Object.fromEntries(SPEC_FIELDS.map(([source]) => [source, typeof product.specifications[source] === 'string' ? product.specifications[source].trim() || null : null]))
      }))
    }
  };
}

export { SPEC_FIELDS };
