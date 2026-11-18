import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`./${path}`, import.meta.url), "utf8");

test("Employee Directory uses the authenticated employee API in Real Mode without Demo fallback", () => {
  const source = read("UserManagementView.tsx");
  assert.match(source, /useOwnerEmployeeDirectory\(realMode/);
  assert.match(read("../api/ownerEmployeeDirectory.ts"), /\/api\/owner\/employees/);
  assert.match(source, /remote\.data\?\.items/);
  assert.match(source, /remote\.error/);
  assert.match(source, /remote\.refresh/);
  assert.match(source, /Demo accounts are excluded/);
  assert.match(source, /realMode \? "—"/);
  assert.match(source, /getEmployeeDirectory\(\)/);
});

test("Employee Directory supports real filtering, pagination, contact fields, and detail presentation", () => {
  const source = read("UserManagementView.tsx");
  for (const marker of ["Filter by department", "Filter by role", "Filter by employment status", "Previous", "Next", "Employee profile", "Employee ID", "Email", "Phone"]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.match(source, /page, pageSize: workforcePageSize/);
  assert.match(source, /role: roleFilter/);
  assert.match(source, /department: departmentFilter/);
  assert.match(source, /employee\.employeeId \|\| employee\.id/);
});

test("Employee Directory remains separate from Admin Employee Management and preserves role access", () => {
  const source = read("UserManagementView.tsx");
  assert.match(source, /if \(role === "owner"\) return <EmployeeDirectory \/>/);
  assert.match(source, /if \(role === "admin"\) return <AdminManagementHub \/>/);
  assert.match(source, /function AdminManagementHub/);
  assert.match(source, /<EmployeeManagement \/>/);
  assert.match(source, /<ClientManagement \/>/);
  assert.match(source, /<RolesPermissions \/>/);
  assert.match(read("../role-access.js"), /owner: \[.*users/);
});

test("Owner dashboard uses the Owner API instead of the Sales-only dashboard route", () => {
  const source = read("AnalyticsFullView.tsx");
  assert.match(source, /'\/api\/owner\/dashboard', realMode && role === 'owner'/);
  assert.doesNotMatch(source, /\/api\/sales\//);
});

test("Owner dashboard KPI cards use established server aggregates instead of local Demo stores", () => {
  const source = read("AnalyticsFullView.tsx");
  for (const field of ['pendingInquiries', 'quotationsSent', 'purchaseOrdersReceived', 'verifiedRevenue']) assert.ok(source.includes(`owner.data?.${field}`) || source.includes(`owner.data.${field}`));
  assert.match(source, /not period filtered/);
  assert.match(source, /onClick=\{owner\.refresh\}/);
});
