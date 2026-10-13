import { useCallback, useEffect, useState, type LucideIcon } from "react";
import { AlertCircle, Building2, Clock3, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { getAccounts, subscribeToAccounts, type Account } from "../store/accounts";
import { roleMetas } from "./Login";
import { useSession } from "../store/session";
import { Unauthorized } from "./Unauthorized";

interface DashboardCounts {
  employees: number;
  clients: number;
  activeEmployees: number;
  roles: number;
}

interface Metric {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  background: string;
}

function getDashboardCounts(accounts: Account[]): DashboardCounts {
  const employees = accounts.filter((account) => account.type === "employee" && account.role !== "client");
  const clients = accounts.filter((account) => account.type === "client" && account.role === "client");

  return {
    employees: employees.length,
    clients: clients.length,
    activeEmployees: employees.filter((employee) => employee.active).length,
    roles: Object.keys(roleMetas).filter((role) => role !== "client").length,
  };
}

export function AdminDashboard() {
  const { role } = useSession();
  if (role !== "admin") return <Unauthorized />;
  return <AdminDashboardPage />;
}

function AdminDashboardPage() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    try {
      setCounts(getDashboardCounts(getAccounts()));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load account data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToAccounts(refresh);
  }, [refresh]);

  const metrics: Metric[] = counts ? [
    { label: "Total Employees", value: counts.employees, icon: UsersRound, color: "#1A2B4A", background: "#EFF4FA" },
    { label: "Total Clients", value: counts.clients, icon: Building2, color: "#C8102E", background: "#FFF1F2" },
    { label: "Active Employee Accounts", value: counts.activeEmployees, icon: UserCheck, color: "#15803D", background: "#F0FDF4" },
    { label: "System Roles", value: counts.roles, icon: ShieldCheck, color: "#7C3AED", background: "#F5F3FF" },
  ] : [];

  return (
    <main className="flex-1 min-w-0 h-full overflow-auto" style={{ backgroundColor: "#F5F7FB" }}>
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: "#C8102E", backgroundColor: "#FFF1F2" }}>
              <ShieldCheck size={19} aria-hidden />
            </span>
            <h1 className="font-syne" style={{ fontSize: 27, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Admin Dashboard</h1>
          </div>
          <p className="font-dm ml-11 mt-1" style={{ fontSize: 13, color: "#64748B" }}>Overview of employee accounts, client accounts, and administrative activity.</p>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }, (_, index) => (
              <div key={index} aria-label="Loading account metrics" className="h-32 animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5">
                <div className="h-4 w-2/3 rounded bg-slate-100" />
                <div className="mt-5 h-8 w-1/3 rounded bg-slate-100" />
              </div>
            ))
            : metrics.map(({ label, value, icon: Icon, color, background }) => (
              <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-dm text-sm font-medium text-slate-500">{label}</p>
                    <p className="mt-3 font-syne text-3xl font-extrabold leading-none text-slate-900">{value.toLocaleString()}</p>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ color, backgroundColor: background }}>
                    <Icon size={20} aria-hidden />
                  </span>
                </div>
              </article>
            ))}
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-dm text-sm font-semibold text-red-900">Account metrics could not be loaded.</p>
              <p className="mt-1 break-words font-dm text-xs text-red-800">{error}</p>
              <button type="button" onClick={refresh} className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 font-dm text-xs font-semibold text-red-800 hover:bg-red-100">Retry</button>
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm" aria-labelledby="admin-activity-heading">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2.5">
              <Clock3 size={18} className="text-slate-500" aria-hidden />
              <h2 id="admin-activity-heading" className="font-syne text-lg font-bold text-slate-900">Recent Administrative Activity</h2>
            </div>
            <p className="mt-1 font-dm text-xs text-slate-500">Latest recorded administrative actions.</p>
          </div>
          <div className="flex min-h-36 flex-col items-center justify-center px-5 py-8 text-center">
            <AlertCircle size={22} className="text-slate-400" aria-hidden />
            <p className="mt-3 font-dm text-sm font-semibold text-slate-700">Administrative audit history is not available.</p>
            <p className="mt-1 max-w-xl font-dm text-xs leading-5 text-slate-500">
              This application does not currently record administrative actions in an audit log. Activity cannot be displayed until that logging is implemented.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
