const FIELDS = new Set([
  'companyName', 'contactPerson', 'email', 'username', 'password', 'phone'
]);

function withinCharacterLimit(value, limit) {
  let count = 0;
  for (const character of value) {
    if (++count > limit) return false;
  }
  return true;
}

function validEmail(value) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) return false;
  if (/[<>()[\],;:"\\\u0000-\u001f\u007f]/u.test(value)) return false;
  const [local, domain] = value.split('@');
  return !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') &&
    domain.split('.').every(label =>
      /^[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}-]*[\p{L}\p{N}\p{M}])?$/u.test(label)
    );
}

// Pure validation: no database/environment imports and no input values in errors.
// This successful result is internal to the service; it includes the raw password.
export function validateRegistration(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
      return { success: false, errors: { body: 'Registration must be a JSON object.' } };
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(descriptors).some(key => !FIELDS.has(key) ||
      !Object.hasOwn(descriptors[key], 'value'))) {
      return { success: false, errors: { body: 'Only supported registration fields are allowed.' } };
    }

    const errors = {};
    const data = {};
    for (const [field, limit] of [
      ['companyName', 200], ['contactPerson', 160], ['email', 254], ['username', 100]
    ]) {
      const value = descriptors[field]?.value;
      if (typeof value !== 'string' || !value.isWellFormed()) {
        errors[field] = `A valid ${field} string is required.`;
        continue;
      }
      const trimmed = value.trim();
      const normalized = field === 'email' ? trimmed.toLowerCase() : trimmed;
      // Login already caps identifiers at 254 JavaScript code units. Keep email
      // within that bound as well as the database's Unicode character limit.
      if (!normalized || !withinCharacterLimit(normalized, limit) ||
        (field === 'email' && normalized.length > 254)) {
        errors[field] = `${field} must contain 1 to ${limit} characters.`;
      } else if (field === 'email' && !validEmail(normalized)) {
        errors.email = 'A valid email address is required.';
      } else {
        data[field] = normalized;
      }
    }

    const password = descriptors.password?.value;
    if (typeof password !== 'string' || password.length < 8 || password.length > 1024) {
      errors.password = 'Password must contain 8 to 1024 JavaScript string code units.';
    } else {
      data.password = password;
    }

    const phone = descriptors.phone?.value;
    if (!descriptors.phone || phone === null) {
      data.phone = null;
    } else if (typeof phone !== 'string' || !phone.isWellFormed() ||
      !withinCharacterLimit(phone.trim(), 40)) {
      errors.phone = 'Phone must be a string of at most 40 characters or null.';
    } else {
      data.phone = phone.trim() || null;
    }

    return Object.keys(errors).length ? { success: false, errors } : { success: true, data };
  } catch {
    return { success: false, errors: { body: 'Registration must be a JSON object.' } };
  }
}
