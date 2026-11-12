-- DRAFT, required reference data only. No demo accounts, credentials, bank
-- accounts, clients, balances, orders, or fabricated operational transactions.
-- Apply once after migrations 001-004. A repeated run must fail, not hide drift.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET time_zone = '+00:00';
START TRANSACTION;

INSERT INTO roles (code, label) VALUES
  ('owner', 'Owner / CEO'),
  ('operations', 'Operations Manager'),
  ('sales', 'Sales Manager'),
  ('accounting', 'Accounting Secretary'),
  ('production', 'Production Manager'),
  ('warehouse', 'Warehouse Staff'),
  ('logistics', 'Logistics Personnel'),
  ('admin', 'Admin'),
  ('client', 'Client');

INSERT INTO modules (code, label) VALUES
  ('dashboard', 'Dashboard'),
  ('sales', 'Sales & Orders'),
  ('production', 'Production Floor'),
  ('inventory', 'Inventory'),
  ('waybill', 'Waybill Scanner'),
  ('waybill-history', 'Waybill History'),
  ('logistics', 'Logistics'),
  ('delivery-receipts', 'Delivery Receipts'),
  ('accounting', 'Payments Ledger'),
  ('analytics', 'Analytics'),
  ('clients', 'Client Management'),
  ('employee-management', 'Employee Management'),
  ('roles', 'Roles & Permissions'),
  ('users', 'Employee Directory'),
  ('notifications', 'Notifications'),
  ('settings', 'Settings'),
  ('client', 'Client Portal'),
  ('logistics-active-jobs', 'Logistics Active Jobs');

INSERT INTO role_modules (role_code, module_code) VALUES
  ('owner', 'analytics'),
  ('owner', 'clients'),
  ('owner', 'users'),
  ('owner', 'notifications'),
  ('owner', 'settings'),
  ('operations', 'dashboard'),
  ('operations', 'sales'),
  ('operations', 'production'),
  ('operations', 'inventory'),
  ('operations', 'waybill'),
  ('operations', 'logistics'),
  ('operations', 'clients'),
  ('operations', 'notifications'),
  ('operations', 'settings'),
  ('sales', 'dashboard'),
  ('sales', 'sales'),
  ('sales', 'clients'),
  ('sales', 'notifications'),
  ('accounting', 'dashboard'),
  ('accounting', 'sales'),
  ('accounting', 'delivery-receipts'),
  ('accounting', 'accounting'),
  ('accounting', 'notifications'),
  ('production', 'dashboard'),
  ('production', 'production'),
  ('production', 'notifications'),
  ('warehouse', 'dashboard'),
  ('warehouse', 'inventory'),
  ('warehouse', 'waybill'),
  ('warehouse', 'waybill-history'),
  ('warehouse', 'notifications'),
  ('logistics', 'dashboard'),
  ('logistics', 'logistics'),
  ('logistics', 'notifications'),
  ('admin', 'dashboard'),
  ('admin', 'clients'),
  ('admin', 'employee-management'),
  ('admin', 'roles'),
  ('logistics', 'logistics-active-jobs'),
  ('client', 'client');

INSERT INTO payment_terms (code, label, days_after_receipt) VALUES
  ('NET15', '15-Day Terms', 15),
  ('NET30', '30-Day Terms', 30);

INSERT INTO filter_types (code, label, template_group) VALUES
  ('OILSEP', 'Oil Separator', 'cylindrical'),
  ('WATSEP', 'Water Separator', 'cylindrical'),
  ('SOLFIL', 'Solvent Filter', 'cylindrical'),
  ('HYDFIL', 'Hydraulic Filter', 'cylindrical'),
  ('AIRFIL', 'Air Filter', 'cylindrical'),
  ('OILFIL', 'Oil Filter', 'cylindrical'),
  ('FUELFIL', 'Fuel Filter', 'cylindrical'),
  ('COALFIL', 'Coalescence Filter', 'cylindrical'),
  ('SEPFIL', 'Separation Filter', 'cylindrical'),
  ('PRIFIL', 'Primary Filter', 'flatPanel'),
  ('PREFIL', 'Pre Filter', 'flatPanel'),
  ('ACTIFIL', 'Activated Carbon Filter', 'flatPanel'),
  ('SECFIL', 'Pocket Bag Filter', 'pocketBag'),
  ('HEPFIL', 'HEPA Filter', 'hepa'),
  ('BAGFIL', 'Bag / Dust Collector', 'bagCollector'),
  ('PADFIL', 'Pad / Disc Filter', 'padDisc');

INSERT INTO material_categories (code, label) VALUES
  ('filter_media', 'Filter Media'),
  ('endcap', 'End Cap / Frame'),
  ('inner_core', 'Inner Core'),
  ('outer_core', 'Outer Core'),
  ('bonding_adhesive', 'Bonding / Adhesive'),
  ('oring', 'O-Ring'),
  ('gasket', 'Gasket'),
  ('packaging', 'Packaging');

INSERT INTO units (code, label) VALUES
  ('roll', 'roll'),
  ('plate', 'plate'),
  ('sheet', 'sheet'),
  ('kg', 'kg'),
  ('gal', 'gal'),
  ('pcs', 'pcs'),
  ('set', 'set'),
  ('m', 'm');

INSERT INTO delivery_methods (code, label) VALUES
  ('Lalamove', 'Lalamove'),
  ('AP Cargo', 'AP Cargo'),
  ('Fast Cargo', 'Fast Cargo'),
  ('Company Vehicle', 'Company Vehicle'),
  ('Client Pick-up', 'Client Pick-up');

INSERT INTO order_stages (code, label, display_order) VALUES
  ('inquiry', 'New Inquiry', 0),
  ('quotation', 'Quotation Sent', 1),
  ('po', 'PO Received', 2),
  ('jo', 'JO Created', 3),
  ('in_production', 'In Production', 4),
  ('quality_inspection', 'Quality Inspection', 5),
  ('ready_for_dispatch', 'Ready for Dispatch', 6),
  ('dispatched', 'Dispatched', 7),
  ('delivered', 'Delivered', 8),
  ('paid', 'Paid', 9),
  ('overdue', 'Overdue', 10);

INSERT INTO production_stages (position, label) VALUES
  (0, 'Molding'),
  (1, 'Cutting of Steel Plate'),
  (2, 'Spotting of Filter Core'),
  (3, 'Assembling'),
  (4, 'Inserting of Filter Media'),
  (5, 'Trimming'),
  (6, 'Top/Bottom Cap Sealing (Heating)'),
  (7, 'Gasket / O-Ring Fitting'),
  (8, 'Quality / Product Inspection');

INSERT INTO schema_migrations(version) VALUES ('seed_001_reference_data');
COMMIT;
