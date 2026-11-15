import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { allowedFor, isAllowedWorkspaceRoute, landingFor } from "./role-access.js";

test("Sales Manager lands on the existing dashboard and keeps its configured navigation", () => {
  assert.equal(landingFor.sales, "dashboard");
  assert.deepEqual(allowedFor.sales, ["dashboard", "sales", "clients", "notifications"]);
});

test("real employee shell route checks allow only role-mapped destinations", () => {
  assert.equal(isAllowedWorkspaceRoute("sales", "sales"), true);
  assert.equal(isAllowedWorkspaceRoute("sales", "clients"), true);
  assert.equal(isAllowedWorkspaceRoute("sales", "employee-management"), false);
  assert.equal(isAllowedWorkspaceRoute("production", "sales"), false);
  assert.equal(isAllowedWorkspaceRoute("warehouse", "inventory-finished"), true);
  assert.equal(isAllowedWorkspaceRoute("logistics", "logistics-active-jobs"), true);
  assert.equal(isAllowedWorkspaceRoute("sales", "logistics-active-jobs"), false);
  assert.equal(isAllowedWorkspaceRoute("unknown", "dashboard"), false);
});

test("each defined employee role maps to existing role-specific Demo workspace implementations", async () => {
  assert.deepEqual(Object.keys(allowedFor).sort(), ["accounting", "admin", "logistics", "operations", "owner", "production", "sales", "warehouse"]);
  for (const role of ["owner", "operations", "sales", "accounting", "production", "warehouse", "logistics"]) {
    assert.ok(allowedFor[role].includes(landingFor[role]), `${role} landing must be allowed`);
    assert.equal(allowedFor[role].includes("employee-management"), false, `${role} must not inherit Admin employee management`);
  }
  assert.equal(Object.hasOwn(allowedFor, "sales_staff"), false, "Sales Staff has no separate backend role definition in this project");
  const workspace = await readFile(new URL("./components/RealRoleWorkspace.tsx", import.meta.url), "utf8");
  for (const screen of ["AnalyticsFullView", "Dashboard", "SalesOrders", "OperationsProductionFloor", "ProductionFloor", "Inventory", "WaybillScanner", "WaybillMonitoring", "Logistics", "OperationsLogistics", "Accounting", "DeliveryReceipts", "Clients", "NotificationsCenter", "UserManagementView", "Settings"]) {
    assert.match(workspace, new RegExp(`import \\{[^}]*${screen}[^}]*\\} from`), `${screen} must reuse the existing workspace`);
  }
  assert.match(workspace, /role === "operations"/);
});

test("Admin navigation remains unchanged", () => {
  assert.equal(landingFor.admin, "dashboard");
  assert.deepEqual(allowedFor.admin, ["dashboard", "clients", "employee-management", "roles"]);
});

test("real employee shell mounts existing stores in isolated real mode", async () => {
  const source = await readFile(new URL("./components/RealEmployeeShell.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("./App.tsx", import.meta.url), "utf8");
  assert.match(source, /OrdersProvider mode="real"/);
  assert.match(source, /MaterialsProvider mode="real"/);
  assert.match(source, /NotificationsProvider mode="real"/);
  assert.match(source, /StockRequestsProvider mode="real"/);
  assert.match(source, /RealRoleWorkspace/);
  assert.match(source, /!isAllowedWorkspaceRoute\(role, active\)/);
  assert.match(source, /mode="real"/);
  assert.match(app, /if\(identity\.roleCode!==['"]admin['"]\)return <RealEmployeeShell/);
  assert.match(app, /if\(demo\) return .*DemoApp/);
});
