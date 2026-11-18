export const allowedFor = {
  /* Owner sees high-level dashboards, client management, and a read-only workforce directory. */
  owner: ["inquiry-rejections", "analytics", "clients", "users", "notifications", "settings"],
  /* Operations Manager: full operational access — analytics and user management are owner-only */
  operations: ["inquiry-rejections", "dashboard", "sales", "production", "inventory", "waybill", "logistics", "clients", "notifications", "settings"],
  sales: ["dashboard", "sales", "clients", "notifications"],
  accounting: ["dashboard", "sales", "delivery-receipts", "accounting", "notifications"],
  production: ["dashboard", "production", "notifications"],
  /* Warehouse: dashboard, inventory, waybill scanner, and waybill history */
  warehouse: ["dashboard", "inventory", "waybill", "waybill-history", "notifications"],
  /* Logistics: dispatch tracking only; Waybill scanning is Warehouse-only */
  logistics: ["dashboard", "logistics", "notifications"],
  admin: ["dashboard", "clients", "employee-management", "roles"],
};

export const landingFor = {
  owner: "analytics",
  operations: "dashboard",
  sales: "dashboard",
  accounting: "dashboard",
  production: "dashboard",
  warehouse: "inventory",
  logistics: "dashboard",
  admin: "dashboard",
  client: "client",
};

export function isAllowedWorkspaceRoute(role, route) {
  if (route === "inventory-finished") return allowedFor[role]?.includes("inventory") ?? false;
  if (route === "logistics-active-jobs") return role === "logistics";
  return allowedFor[role]?.includes(route) ?? false;
}

// Metadata comparison only: workspace routes need not be database modules.
export function hasMatchingDatabaseModules(role, moduleCodes) {
  const routes = allowedFor[role];
  if (!routes) return false;
  // Rejection history is a narrow orders:read view, not a separate module grant.
  const expected = routes.filter(code =>
    !((role === "owner" || role === "operations") && code === "inquiry-rejections"));
  // Preserve the existing database-only Logistics subroute exception.
  const actual = moduleCodes.filter(code => code !== "logistics-active-jobs");
  return expected.sort().join("|") === actual.sort().join("|");
}
