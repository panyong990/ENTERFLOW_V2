// Synthetic fixture specification only. Importing this module does not do I/O.
// Password/hash placeholders are resolved only by the separately approved initializer.
export function fixturePlan(tag = '2f90dcd2bbc8a779') {
  const rows = [];
  const add = (table, ...items) => rows.push(...items.map(values => ({ table, values })));
  const stamp = '2026-11-16 00:00:00.000';
  for (const [code, label] of Object.entries({ admin: 'Admin', owner: 'Owner / CEO', operations: 'Operations Manager',
    sales: 'Sales Manager', accounting: 'Accounting Secretary', production: 'Production Manager',
    warehouse: 'Warehouse Staff', logistics: 'Logistics Personnel', client: 'Client' })) add('roles', { code, label });
  for (const [code, label] of Object.entries({ dashboard: 'Dashboard', clients: 'Client Management',
    'employee-management': 'Employee Management', roles: 'Roles & Permissions', client: 'Client Portal', notifications: 'Notifications' })) add('modules', { code, label });
  for (const module_code of ['dashboard', 'clients', 'employee-management', 'roles']) add('role_modules', { role_code: 'admin', module_code });
  add('role_modules', { role_code: 'client', module_code: 'client' });
  add('payment_terms', { code: 'NET30', label: '30-Day Terms', days_after_receipt: 30 });
  add('filter_types', { code: 'AIRFIL', label: 'Air Filter', template_group: 'cylindrical' });
  add('order_stages', { code: 'inquiry', label: 'Inquiry', display_order: 0 }, { code: 'production', label: 'Production', display_order: 4 });
  add('delivery_methods', { code: 'company', label: 'Company Delivery' });
  add('production_stages', { position: 0, label: 'Scheduled' });
  for (const [id, company_name, active] of [
    [101, `Browser Test Client A ${tag}`, 1], [102, `Browser Test Client B ${tag}`, 1],
    [103, `Admin Browser Client ${tag}`, 1], [104, `Admin Browser Inactive Client ${tag}`, 0],
  ]) add('clients', { id, company_name, contact_person: 'Synthetic Contact', payment_term_code: 'NET30', active });
  const user = (id, display_name, role_code, hash, extra = {}) => ({ id, display_name, role_code,
    account_type: 'employee', email: `synthetic-${id}@example.invalid`, username: `synthetic_${id}`,
    password_hash: `$secret:${hash}`, employee_number: `BT-${id}`, department: 'Operations', job_title: 'Fixture', active: 1, ...extra });
  add('users',
    user(201, 'Browser Test Admin', 'admin', 'adminHash', { username: `browser_admin_${tag}` }),
    user(202, 'Browser Test Sales Employee', 'sales', 'unusedHash'),
    user(203, 'Browser Test Inactive Employee', 'operations', 'unusedHash', { active: 0 }),
    ...[101, 102, 103, 104].map((client_id, index) => user(211 + index, `Synthetic Client ${index + 1}`, 'client', index === 0 ? 'clientAHash' : index === 1 ? 'clientBHash' : 'unusedHash', {
      account_type: 'client', client_id, employee_number: null,
      email: `browser-client-${index === 0 ? 'a' : index === 1 ? 'b' : index}-${tag}@example.invalid`, active: index === 3 ? 0 : 1,
    })),
  );
  add('client_applications', { id: 301, company_name: `Synthetic Pending Company ${tag}`, contact_person: 'Synthetic Applicant',
    email: `pending-${tag}@example.invalid`, username: `pending_${tag}`, password_hash: '$secret:unusedHash' });
  add('audit_events', { actor_id: 201, action: 'employee.created', subject_type: 'user', subject_identifier: '202',
    old_value: null, new_value: JSON.stringify({ syntheticFixture: true, id: '202' }), request_id: 'task29-synthetic-initial-activity' });
  for (const [id, client_id, reference, stage_code, created_by] of [
    [401, 101, `BT-A-ORD-${tag}`, 'production', 211], [402, 101, `BT-A-INQ-${tag}`, 'inquiry', 211],
    [403, 102, `BT-B-ORD-${tag}`, 'production', 212],
  ]) add('orders', { id, client_id, reference, stage_code, created_by, contact_person: 'Synthetic Contact', payment_term_code: 'NET30', delivery_method_code: 'company' });
  for (const [id, client_id, order_id] of [[501, 101, 401], [502, 101, 402], [503, 102, 403]]) {
    add('product_specifications', { id, client_id, filter_type_code: 'AIRFIL', filter_name: 'Synthetic Air Filter' });
    add('order_items', { id: id + 100, client_id, order_id, specification_id: id, line_number: 1, quantity: 10 });
  }
  for (const [id, order_id, prefix] of [[701, 401, 'A'], [702, 403, 'B']]) {
    const reference = `BT-${prefix}-QT-${tag}`;
    add('quotation_references', { reference, order_id });
    add('quotations', { id, order_id, reference, revision_number: 2, status: 'sent', issued_on: '2026-11-16', valid_until: '2099-12-31',
      payment_term_code: 'NET30', time_of_delivery: 'Synthetic delivery', place_of_delivery: 'Synthetic address',
      total_amount: '1200.00', downpayment_percent: '30.0000', downpayment_amount: '360.00', prepared_by: 202, sent_by: 202, sent_at: stamp });
    add('quotation_lines', { quotation_id: id, order_id, line_number: 1, description: 'Synthetic filters', quantity: '10.0000', unit_label: 'piece', unit_price: '120.0000' });
  }
  add('purchase_orders', { id: 801, order_id: 401, accepted_quotation_id: 701, reference: `BT-A-PO-${tag}`, client_reference: 'Synthetic Client PO', uploaded_by: 211 });
  add('job_orders', { id: 901, reference: `BT-A-JO-${tag}`, order_id: 401, client_id: 101, order_item_id: 601, specification_id: 501,
    quantity: 10, production_due_date: '2099-12-30', created_by: 202 });
  add('shipments', { id: 1001, job_order_id: 901, order_id: 401, delivery_method_code: 'company', status: 'pending',
    tracking_reference: `BT-A-TRACK-${tag}`, estimated_delivery_date: '2099-12-31', updated_by: 202 });
  add('invoices', { id: 1101, order_id: 401, reference: `BT-A-INV-${tag}`, issued_on: '2026-11-16', amount: '1200.00', payment_term_code: 'NET30',
    required_downpayment: '360.00', created_by: 201, sent_at: stamp, sent_by: 201 });
  for (const [id, verification_status, reviewed] of [[1201, 'verified', true], [1202, 'pending', false], [1203, 'rejected', true]]) add('payments', {
    id, order_id: 401, invoice_id: 1101, payment_type: 'DOWNPAYMENT', submitted_amount: '360.00',
    verified_amount: verification_status === 'verified' ? '360.00' : null, method: 'Synthetic', paid_on: '2026-11-16', verification_status,
    submitted_by: 211, reviewed_by: reviewed ? 201 : null, reviewed_at: reviewed ? stamp : null, idempotency_key: `task29-fixture-${id}`,
  });
  for (const [id, client_id, user_id, title, read_at, dismissed_at] of [
    [1301, 101, 211, 'Browser test update A', null, null], [1302, 101, 211, 'Browser test read A', stamp, null],
    [1303, 101, 211, 'Browser test dismissed A', null, stamp], [1304, 102, 212, 'Browser test update B', stamp, null],
  ]) {
    add('notifications', { id, department: 'system', title, body: 'Synthetic browser fixture only', client_id, created_by: 201 });
    add('notification_recipients', { notification_id: id, user_id, read_at, dismissed_at });
  }
  return { rows, ids: { employeeA: '202', clientA: '103' },
    admin: { username: `browser_admin_${tag}`, password: '$secret:adminPassword' },
    clients: [{ email: `browser-client-a-${tag}@example.invalid`, password: '$secret:clientAPassword' },
      { email: `browser-client-b-${tag}@example.invalid`, password: '$secret:clientBPassword' }] };
}
