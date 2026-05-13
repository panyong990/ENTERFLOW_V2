import { LayoutDashboard, ShoppingCart, Factory, ScanLine, Truck, Calculator, Users, LogOut, Building2, Settings as SettingsIcon, Boxes, BarChart3 } from "lucide-react";
import type { Role } from "./Login";
import { roleMetas } from "./Login";

const navItems = [
  { id: "dashboard",  label: "Dashboard",         icon: LayoutDashboard },
  { id: "sales",      label: "Sales & Orders",    icon: ShoppingCart },
  { id: "production", label: "Production Floor",  icon: Factory },
  { id: "inventory",  label: "Inventory",         icon: Boxes },
  { id: "waybill",    label: "Waybill Scanner",   icon: ScanLine },
  { id: "logistics",  label: "Logistics",         icon: Truck },
  { id: "accounting", label: "Payments Ledger",   icon: Calculator },
  { id: "analytics",  label: "Analytics",         icon: BarChart3 },
  { id: "clients",    label: "Client Management", icon: Building2 },
  { id: "users",      label: "User Management",   icon: Users },
];

export const allowedFor: Record<Exclude<Role, "client">, string[]> = {
  /* Owner sees ONLY high-level: dashboard (all analytics + drill-down), client management, user management */
  owner:      ["dashboard", "analytics", "clients", "users", "notifications", "settings"],
  /* Operations Manager: full operational access — analytics and user management are owner-only */
  operations: ["dashboard", "sales", "production", "inventory", "waybill", "logistics", "accounting", "clients", "notifications", "settings"],
  sales:      ["dashboard", "sales", "clients", "notifications"],
  accounting: ["dashboard", "sales", "logistics", "accounting", "notifications"],
  production: ["dashboard", "production", "notifications"],
  /* Warehouse: only dashboard + inventory + waybill (production stage marking lives inside production access on the floor) */
  warehouse:  ["dashboard", "inventory", "waybill", "notifications"],
  /* Logistics: focused on logistics + waybill — no inventory, no dashboard active jobs */
  logistics:  ["dashboard", "logistics", "waybill", "notifications"],
};

export const roleSidebar: Record<Exclude<Role, "client">, { user: string; title: string }> = {
  owner:      { user: "T. Mendoza", title: "Owner / CEO" },
  operations: { user: "M. Aquino",  title: "Operations Manager" },
  sales:      { user: "R. Santos",  title: "Sales Manager" },
  accounting: { user: "L. Cruz",    title: "Accounting Secretary" },
  production: { user: "J. Reyes",   title: "Production Manager" },
  warehouse:  { user: "F. Santos",  title: "Warehouse Staff" },
  logistics:  { user: "P. Tan",     title: "Logistics Personnel" },
};

interface SidebarProps {
  active?: string;
  onNavigate?: (id: string) => void;
  onLogout?: () => void;
  role: Exclude<Role, "client">;
  badges?: Partial<Record<string, number>>;
  unreadNotif?: number;
}

export function Sidebar({ active = "dashboard", onNavigate, onLogout, role, badges = {}, unreadNotif = 0 }: SidebarProps) {
  const allowed = allowedFor[role];
  const visible = navItems.filter((n) => allowed.includes(n.id));
  const meta = roleMetas[role];
  const sb = roleSidebar[role];
  const initials = sb.user.split(" ").map(s => s[0]).slice(0, 2).join("");

  return (
    <aside
      className="w-[240px] h-full flex flex-col text-white font-dm shrink-0"
      style={{ backgroundColor: "#1A2B4A" }}
      aria-label="Primary navigation"
    >
      <div className="px-6 py-6 border-b border-white/10">
        <div className="font-syne tracking-tight flex items-center gap-2" style={{ fontSize: 20, fontWeight: 800 }}>
          <span aria-hidden style={{ color: "#C8102E" }}>▲</span>
          <span>ENTER-FLOW</span>
        </div>
        <div className="text-white/50 mt-1" style={{ fontSize: 11, letterSpacing: 0.4, lineHeight: 1.4 }}>
          Order Management &amp; Real-Time Monitoring
        </div>
      </div>

      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-auto" aria-label="Sections">
        {visible.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          const badge = badges[item.id] ?? 0;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate?.(item.id)}
              aria-current={isActive ? "page" : undefined}
              className="relative flex items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-white/5"
              style={{
                fontSize: 14,
                color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.7)",
                backgroundColor: isActive ? "rgba(200,16,46,0.15)" : "transparent",
                borderLeft: isActive ? "3px solid #C8102E" : "3px solid transparent",
                paddingLeft: isActive ? 21 : 24,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon size={18} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span
                  className="font-syne min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#C8102E", fontSize: 10, fontWeight: 800, letterSpacing: 0.3 }}
                  aria-label={`${badge} new`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {(role === "owner" || role === "operations") && (
        <button
          onClick={() => onNavigate?.("settings")}
          aria-current={active === "settings" ? "page" : undefined}
          className="flex items-center gap-2.5 px-6 py-2.5 text-left transition-colors hover:bg-white/5 border-t border-white/10"
          style={{
            fontSize: 12,
            color: active === "settings" ? "#FFFFFF" : "rgba(255,255,255,0.55)",
            backgroundColor: active === "settings" ? "rgba(200,16,46,0.15)" : "transparent",
            borderLeft: active === "settings" ? "3px solid #C8102E" : "3px solid transparent",
            paddingLeft: active === "settings" ? 21 : 24,
            fontWeight: active === "settings" ? 600 : 400,
          }}
        >
          <SettingsIcon size={14} aria-hidden />
          <span>Settings</span>
        </button>
      )}

      <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between gap-2">
        <span
          className="font-dm inline-flex items-center px-2.5 py-1 rounded-full"
          style={{ fontSize: 11, fontWeight: 700, backgroundColor: meta.bg, color: meta.fg, letterSpacing: 0.4 }}
        >
          {meta.label}
        </span>
        {unreadNotif > 0 && (
          <span
            className="font-dm inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#C8102E", color: "white" }}
            title={`${unreadNotif} unread notifications`}
          >
            🔔 {unreadNotif}
          </span>
        )}
      </div>

      <div className="px-6 py-4 border-t border-white/10 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-syne shrink-0"
          style={{ backgroundColor: meta.avatarBg, fontSize: 13, fontWeight: 700 }}
          aria-hidden
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: 13, fontWeight: 600 }}>{sb.user}</div>
          <div className="text-white/50 truncate" style={{ fontSize: 11 }}>{sb.title}</div>
        </div>
        <button
          onClick={onLogout}
          aria-label="Log out"
          className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/10 text-white/70 hover:text-white"
        >
          <LogOut size={15} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
