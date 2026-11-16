import type { Role } from "./Login";
import { allowedFor } from "./Sidebar";

const clientRoutes = new Set(["orders", "status", "logistics", "accounting", "settings", "notifications"]);

export function canNavigateToNotification(role: Role, route: string): boolean {
  if (role === "client") return clientRoutes.has(route);
  return allowedFor[role].includes(route);
}
