import { ShieldCheck } from "lucide-react";
import { allowedFor } from "./Sidebar";
import { roleMetas, type Role } from "./Login";
import { useSession } from "../store/session";
import { Unauthorized } from "./Unauthorized";

const employeeRoles = Object.keys(roleMetas).filter((role) => role !== "client") as Exclude<Role, "client">[];
const moduleNames: Record<string, string> = {
  dashboard: "Dashboard",
  sales: "Sales & Orders",
  production: "Production Floor",
  inventory: "Inventory",
  waybill: "Waybill Scanner",
  "waybill-history": "Waybill History",
  logistics: "Logistics",
  "delivery-receipts": "Delivery Receipts",
  accounting: "Payments Ledger",
  analytics: "Analytics",
  clients: "Client Management",
  "employee-management": "Employee Management",
  roles: "Roles & Permissions",
  users: "Employee Directory",
  notifications: "Notifications",
  settings: "Settings",
};

export function RolesPermissions() {
  const { role } = useSession();
  if (role !== "admin") return <Unauthorized />;

  return (
    <main className="flex-1 min-w-0 h-full overflow-auto" style={{ backgroundColor: "#F5F7FB" }}>
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: "#C8102E", backgroundColor: "#FFF1F2" }}><ShieldCheck size={19} /></span>
            <h1 className="font-syne" style={{ fontSize: 27, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Roles &amp; Permissions</h1>
          </div>
          <p className="font-dm ml-11 mt-1" style={{ fontSize: 13, color: "#64748B" }}>Review the existing system roles and their module access.</p>
        </div>
      </header>
      <section className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 sm:py-8">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <h2 className="font-syne text-lg font-bold text-slate-900">Role access matrix</h2>
            <p className="mt-1 font-dm text-xs text-slate-500">Role definitions and module access are read from the existing application permissions.</p>
          </div>
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[70%]" />
            </colgroup>
            <thead className="bg-slate-50/80"><tr>
                <th className="px-3 py-3 text-left font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-5">System role</th>
                <th className="px-3 py-3 text-left font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-5">Authorized modules</th>
              </tr></thead>
            <tbody>{employeeRoles.map((staffRole) => {
              const meta = roleMetas[staffRole];
              return <tr key={staffRole} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-3 sm:px-5 sm:py-4"><span className="inline-flex max-w-full whitespace-normal break-words rounded-full px-2.5 py-1 font-dm text-xs font-semibold leading-4" style={{ backgroundColor: meta.bg, color: meta.fg }}>{meta.label}</span></td>
                  <td className="px-3 py-3 sm:px-5 sm:py-4"><div className="flex flex-wrap gap-1.5 sm:gap-2">{allowedFor[staffRole].map((module) => <span key={module} className="max-w-full whitespace-normal break-words rounded-full bg-slate-100 px-2.5 py-1 font-dm text-[11px] leading-4 text-slate-600">{moduleNames[module] || module}</span>)}</div></td>
                </tr>;
            })}</tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
