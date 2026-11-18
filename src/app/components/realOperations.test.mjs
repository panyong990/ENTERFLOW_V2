import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = name => fs.readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

test("Real Operations production monitoring uses the authenticated Production API", () => {
  const workspace = read("RealRoleWorkspace.tsx");
  const dashboard = read("Dashboard.tsx");
  assert.match(workspace, /route === "production" && role === "operations"\) return <OperationsProductionFloor \/>/);
  assert.match(read("OperationsProductionFloor.tsx"), /useProductionJobOrders/);
  assert.match(dashboard, /useProductionJobOrders\(\{ q: '', status: 'all' \}, null, realMode && \(role === 'operations' \|\| role === 'production'\)\)/);
  assert.match(dashboard, /Authenticated Production API/);
});

test("Real Operations does not present unsupported local dashboard metrics", () => {
  const dashboard = read("Dashboard.tsx");
  assert.match(dashboard, /Dashboard metrics without an approved aggregate remain unavailable/);
  assert.match(dashboard, /Retry Production records/);
  assert.match(read("OperationsProductionFloor.tsx"), /Company-wide KPI definitions remain unavailable/);
});
