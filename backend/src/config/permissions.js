
const PERMISSIONS = Object.freeze({
  admin: {
    users: [
      'read',
      'create',
      'update',
      'activate',
      'deactivate',
      'resetPassword',
      'assignRole'
    ],
    clientAccounts: [
      'read',
      'update',
      'activate',
      'deactivate'
    ],
    clients: ['read'],
    inquiries: ['read', 'update'],
    quotations: ['read', 'create', 'update'],
    orders: ['read', 'create', 'update'],
    production: ['read', 'update'],
    inventory: ['read', 'update'],
    deliveries: ['read', 'update'],
    reports: ['read']
  },

  owner: {
    clients: ['read'],
    inquiries: ['read'],
    quotations: ['read'],
    orders: ['read'],
    production: ['read'],
    inventory: ['read'],
    deliveries: ['read'],
    waybills: ['read'],
    deliveryReceipts: ['read'],
    payments: ['read'],
    reports: ['read']
  },

  sales: {
    clients: ['read', 'create', 'update'],
    inquiries: ['read', 'update'],
    quotations: ['read', 'create', 'update', 'approve'],
    orders: ['read', 'create', 'update', 'approve']
  },

  production: {
    orders: ['read'],
    production: ['read', 'update'],
    inventory: ['read']
  },

  warehouse: {
    production: ['read'],
    inventory: ['read', 'update'],
    deliveries: ['read', 'update'],
    waybills: ['read', 'create', 'update']
  },

  logistics: {
    deliveries: ['read', 'update'],
    waybills: ['read']
  },

  accounting: {
    orders: ['read'],
    deliveries: ['read'],
    deliveryReceipts: ['read', 'create', 'update'],
    payments: ['read', 'create', 'update', 'verify'],
    reports: ['read']
  },

  operations: {
    clients: ['read'],
    orders: ['read'],
    production: ['read'],
    inventory: ['read'],
    deliveries: ['read'],
    reports: ['read']
  },

  client: {
    clients: ['read'],
    inquiries: ['read', 'create'],
    quotations: ['read'],
    orders: ['read'],
    payments: ['read', 'create']
  }
});

export function hasPermission(roleCode, resource, action) {
  if (
    typeof roleCode !== 'string' ||
    typeof resource !== 'string' ||
    typeof action !== 'string'
  ) {
    return false;
  }

  const rolePermissions = PERMISSIONS[roleCode];
  const resourcePermissions = rolePermissions?.[resource];

  return Array.isArray(resourcePermissions) &&
    resourcePermissions.includes(action);
}

export function getPermissions(roleCode) {
  const rolePermissions = PERMISSIONS[roleCode];

  if (!rolePermissions) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(rolePermissions).map(([resource, actions]) => [
      resource,
      [...actions]
    ])
  );
}

export { PERMISSIONS };
