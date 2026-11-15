
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPermission,
  getPermissions
} from './permissions.js';

// ADMIN

test('only Admin can read, approve, and reject client applications', () => {
  assert.deepEqual(getPermissions('admin').clientApplications, ['read', 'approve', 'reject']);
  for (const action of ['read', 'approve', 'reject']) {
    assert.equal(hasPermission('admin', 'clientApplications', action), true);
    for (const role of ['owner', 'sales', 'operations', 'production', 'warehouse', 'logistics', 'accounting', 'client', 'unknown']) {
      assert.equal(hasPermission(role, 'clientApplications', action), false);
    }
  }
  assert.equal(hasPermission('admin', 'clientApplications', 'create'), false);
  assert.equal(hasPermission('admin', 'clientAccounts', 'create'), false);
  assert.equal(hasPermission('admin', 'clients', 'create'), false);
});

test('admin can manage employee accounts', () => {
  assert.equal(hasPermission('admin', 'users', 'read'), true);
  assert.equal(hasPermission('admin', 'users', 'create'), true);
  assert.equal(hasPermission('admin', 'users', 'update'), true);
  assert.equal(hasPermission('admin', 'users', 'activate'), true);
  assert.equal(hasPermission('admin', 'users', 'deactivate'), true);
  assert.equal(hasPermission('admin', 'users', 'resetPassword'), true);
  assert.equal(hasPermission('admin', 'users', 'assignRole'), true);
});

test('admin cannot create roles or modify role definitions', () => {
  assert.equal(hasPermission('admin', 'roles', 'create'), false);
  assert.equal(hasPermission('admin', 'roles', 'update'), false);
});

test('admin can manage existing client accounts but cannot create them', () => {
  assert.equal(hasPermission('admin', 'clientAccounts', 'read'), true);
  assert.equal(hasPermission('admin', 'clientAccounts', 'update'), true);
  assert.equal(hasPermission('admin', 'clientAccounts', 'activate'), true);
  assert.equal(hasPermission('admin', 'clientAccounts', 'deactivate'), true);
  assert.equal(hasPermission('admin', 'clientAccounts', 'create'), false);
});

test('admin cannot approve quotations or orders', () => {
  assert.equal(hasPermission('admin', 'quotations', 'approve'), false);
  assert.equal(hasPermission('admin', 'orders', 'approve'), false);
});

test('admin has no payment permissions', () => {
  assert.equal(hasPermission('admin', 'payments', 'read'), false);
  assert.equal(hasPermission('admin', 'payments', 'create'), false);
  assert.equal(hasPermission('admin', 'payments', 'update'), false);
  assert.equal(hasPermission('admin', 'payments', 'verify'), false);
});

// OWNER

test('owner can view business records', () => {
  assert.equal(hasPermission('owner', 'clients', 'read'), true);
  assert.equal(hasPermission('owner', 'inquiries', 'read'), true);
  assert.equal(hasPermission('owner', 'quotations', 'read'), true);
  assert.equal(hasPermission('owner', 'orders', 'read'), true);
  assert.equal(hasPermission('owner', 'production', 'read'), true);
  assert.equal(hasPermission('owner', 'inventory', 'read'), true);
  assert.equal(hasPermission('owner', 'deliveries', 'read'), true);
  assert.equal(hasPermission('owner', 'payments', 'read'), true);
  assert.equal(hasPermission('owner', 'reports', 'read'), true);
});

test('owner cannot modify business records', () => {
  assert.equal(hasPermission('owner', 'orders', 'update'), false);
  assert.equal(hasPermission('owner', 'quotations', 'approve'), false);
  assert.equal(hasPermission('owner', 'payments', 'verify'), false);
});

// SALES

test('sales can manage client company information', () => {
  assert.equal(hasPermission('sales', 'clients', 'read'), true);
  assert.equal(hasPermission('sales', 'clients', 'create'), true);
  assert.equal(hasPermission('sales', 'clients', 'update'), true);
});

test('sales can manage and approve quotations', () => {
  assert.equal(hasPermission('sales', 'quotations', 'read'), true);
  assert.equal(hasPermission('sales', 'quotations', 'create'), true);
  assert.equal(hasPermission('sales', 'quotations', 'update'), true);
  assert.equal(hasPermission('sales', 'quotations', 'approve'), true);
});

test('sales can manage and approve orders', () => {
  assert.equal(hasPermission('sales', 'orders', 'read'), true);
  assert.equal(hasPermission('sales', 'orders', 'create'), true);
  assert.equal(hasPermission('sales', 'orders', 'update'), true);
  assert.equal(hasPermission('sales', 'orders', 'approve'), true);
});

test('sales cannot verify payments', () => {
  assert.equal(hasPermission('sales', 'payments', 'verify'), false);
});

// PRODUCTION

test('production can update production records', () => {
  assert.equal(hasPermission('production', 'production', 'read'), true);
  assert.equal(hasPermission('production', 'production', 'update'), true);
});

test('production can view orders and inventory', () => {
  assert.equal(hasPermission('production', 'orders', 'read'), true);
  assert.equal(hasPermission('production', 'inventory', 'read'), true);
});

test('production cannot manage deliveries or payments', () => {
  assert.equal(hasPermission('production', 'deliveries', 'update'), false);
  assert.equal(hasPermission('production', 'payments', 'read'), false);
});

// WAREHOUSE

test('warehouse can manage inventory', () => {
  assert.equal(hasPermission('warehouse', 'inventory', 'read'), true);
  assert.equal(hasPermission('warehouse', 'inventory', 'update'), true);
});

test('warehouse can manage deliveries and waybills', () => {
  assert.equal(hasPermission('warehouse', 'deliveries', 'read'), true);
  assert.equal(hasPermission('warehouse', 'deliveries', 'update'), true);
  assert.equal(hasPermission('warehouse', 'waybills', 'read'), true);
  assert.equal(hasPermission('warehouse', 'waybills', 'create'), true);
  assert.equal(hasPermission('warehouse', 'waybills', 'update'), true);
});

// LOGISTICS

test('logistics can manage delivery records and view waybills', () => {
  assert.equal(hasPermission('logistics', 'deliveries', 'read'), true);
  assert.equal(hasPermission('logistics', 'deliveries', 'update'), true);
  assert.equal(hasPermission('logistics', 'waybills', 'read'), true);
});

test('logistics cannot manage inventory or payments', () => {
  assert.equal(hasPermission('logistics', 'inventory', 'update'), false);
  assert.equal(hasPermission('logistics', 'payments', 'read'), false);
});

// ACCOUNTING

test('accounting can manage and verify payments', () => {
  assert.equal(hasPermission('accounting', 'payments', 'read'), true);
  assert.equal(hasPermission('accounting', 'payments', 'create'), true);
  assert.equal(hasPermission('accounting', 'payments', 'update'), true);
  assert.equal(hasPermission('accounting', 'payments', 'verify'), true);
});

test('accounting can manage delivery receipts', () => {
  assert.equal(hasPermission('accounting', 'deliveryReceipts', 'read'), true);
  assert.equal(hasPermission('accounting', 'deliveryReceipts', 'create'), true);
  assert.equal(hasPermission('accounting', 'deliveryReceipts', 'update'), true);
});

test('accounting can view orders, deliveries, and reports', () => {
  assert.equal(hasPermission('accounting', 'orders', 'read'), true);
  assert.equal(hasPermission('accounting', 'deliveries', 'read'), true);
  assert.equal(hasPermission('accounting', 'reports', 'read'), true);
});

// OPERATIONS

test('operations can view operational records and reports', () => {
  assert.equal(hasPermission('operations', 'clients', 'read'), true);
  assert.equal(hasPermission('operations', 'orders', 'read'), true);
  assert.equal(hasPermission('operations', 'production', 'read'), true);
  assert.equal(hasPermission('operations', 'inventory', 'read'), true);
  assert.equal(hasPermission('operations', 'deliveries', 'read'), true);
  assert.equal(hasPermission('operations', 'reports', 'read'), true);
});

// CLIENT

test('client can submit inquiries and view permitted records', () => {
  assert.equal(hasPermission('client', 'inquiries', 'create'), true);
  assert.equal(hasPermission('client', 'inquiries', 'read'), true);
  assert.equal(hasPermission('client', 'clients', 'read'), true);
  assert.equal(hasPermission('client', 'quotations', 'read'), true);
  assert.equal(hasPermission('client', 'orders', 'read'), true);
});

test('client can submit and view payment records', () => {
  assert.equal(hasPermission('client', 'payments', 'read'), true);
  assert.equal(hasPermission('client', 'payments', 'create'), true);
  assert.equal(hasPermission('client', 'payments', 'verify'), false);
});

test('client cannot approve orders or access internal operational records', () => {
  assert.equal(hasPermission('client', 'orders', 'approve'), false);
  assert.equal(hasPermission('client', 'production', 'read'), false);
  assert.equal(hasPermission('client', 'inventory', 'read'), false);
  assert.equal(hasPermission('client', 'users', 'read'), false);
});

// GENERAL PERMISSION CHECKS

test('unknown roles are denied', () => {
  assert.equal(hasPermission('unknown', 'orders', 'read'), false);
});

test('unknown resources and actions are denied', () => {
  assert.equal(hasPermission('admin', 'unknown', 'read'), false);
  assert.equal(hasPermission('admin', 'orders', 'unknown'), false);
});

test('invalid arguments are denied', () => {
  assert.equal(hasPermission(null, 'orders', 'read'), false);
  assert.equal(hasPermission('admin', null, 'read'), false);
  assert.equal(hasPermission('admin', 'orders', null), false);
});

test('getPermissions returns an independent copy', () => {
  const permissions = getPermissions('sales');

  permissions.quotations.push('unauthorizedAction');

  assert.equal(
    hasPermission('sales', 'quotations', 'unauthorizedAction'),
    false
  );
});

test('unknown roles return an empty permission object', () => {
  assert.deepEqual(getPermissions('unknown'), {});
});
