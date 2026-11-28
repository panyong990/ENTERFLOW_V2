export function resolveFinishedGoodsOEM(dedicatedValue, specifications) {
  let specs = specifications;

  if (typeof specs === 'string') {
    specs = JSON.parse(specs);
  }

  if (specs != null && (
    typeof specs !== 'object' || Array.isArray(specs)
  )) {
    throw new Error('Invalid stored specifications');
  }

  const values = [
    dedicatedValue,
    specs?.oem,
    specs?.oem_part_number
  ];

  if (values.some(value =>
    value != null && typeof value !== 'string'
  )) {
    throw new Error('Invalid stored OEM value');
  }

  const populated = values
    .filter(value => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean);

  const distinct = new Set(
    populated.map(value => value.toLocaleLowerCase())
  );

  if (distinct.size > 1) {
    throw new Error('Conflicting stored OEM references');
  }

  return populated[0] ?? null;
}
