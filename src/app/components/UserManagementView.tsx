import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Building2, Check, KeyRound, Pencil, Plus, Power, Search, ShieldCheck, SlidersHorizontal, UserRound, UserRoundCog, Users, X } from "lucide-react";
import { Toaster, toast } from "sonner";
import { getAccounts, getEmployeeDirectory, saveAccounts, type Account, type AccountRole, type EmployeeDirectoryEntry } from "../store/accounts";
import { useSession } from "../store/session";
import { Unauthorized } from "./Unauthorized";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type AccountType = Account["type"];
type StaffRole = Exclude<AccountRole, "client">;

const staffRoles: { id: StaffRole; label: string }[] = [
  { id: "owner", label: "Owner" },
  { id: "operations", label: "Operations Manager" },
  { id: "sales", label: "Sales" },
  { id: "accounting", label: "Accounting" },
  { id: "production", label: "Production" },
  { id: "warehouse", label: "Warehouse" },
  { id: "logistics", label: "Logistics" },
];

const roleLabels: Record<StaffRole, string> = {
  admin: "Admin",
  owner: "Owner",
  operations: "Operations Manager",
  sales: "Sales",
  accounting: "Accounting",
  production: "Production",
  warehouse: "Warehouse",
  logistics: "Logistics",
};

const accessLevels: { id: AccountRole; label: string; description: string; bg: string; fg: string }[] = [
  { id: "admin", label: "Admin", description: "Manage employee and client accounts", bg: "#EDE9FE", fg: "#5B21B6" },
  { id: "owner", label: "Owner / CEO", description: "Executive dashboard, analytics, and read-only employee directory", bg: "#FEF3C7", fg: "#92400E" },
  { id: "operations", label: "Operations Manager", description: "Full operational access across ERP modules", bg: "#FEE2E2", fg: "#991B1B" },
  { id: "sales", label: "Sales Manager", description: "Sales pipeline, quotations, and client management", bg: "#FFE4E6", fg: "#9F1239" },
  { id: "accounting", label: "Accounting Secretary", description: "Payments ledger, receipts, and overdue tracking", bg: "#DCFCE7", fg: "#166534" },
  { id: "production", label: "Production Manager", description: "Production floor, stage updates, and job orders", bg: "#DBEAFE", fg: "#1D4ED8" },
  { id: "warehouse", label: "Warehouse Staff", description: "Inventory, waybills, and stock requests", bg: "#E2E8F0", fg: "#475569" },
  { id: "logistics", label: "Logistics Personnel", description: "Logistics and dispatch tracking", bg: "#FFEDD5", fg: "#9A3412" },
  { id: "client", label: "Client", description: "Client portal access to company services", bg: "#EFF6FF", fg: "#1E40AF" },
];

const newDraft = (type: AccountType): Omit<Account, "id" | "joined" | "active"> => ({
  type,
  name: "",
  email: "",
  username: "",
  phone: "",
  role: type === "client" ? "client" : "sales",
  password: "demo",
  emailAlerts: true,
});

function createTemporaryPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function formattedRole(role: AccountRole): string {
  return role === "client" ? "Client" : roleLabels[role];
}

const workforceTitleByRole: Record<StaffRole, string> = {
  admin: "Admin",
  owner: "Owner / CEO",
  operations: "Operations Manager",
  sales: "Sales Manager",
  accounting: "Accounting Secretary",
  production: "Production Manager",
  warehouse: "Warehouse Staff",
  logistics: "Logistics Personnel",
};

const workforcePageSize = 10;

function EmployeeDirectory() {
  const [employees] = useState<EmployeeDirectoryEntry[]>(getEmployeeDirectory);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<EmployeeDirectoryEntry["role"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [draftDepartmentFilter, setDraftDepartmentFilter] = useState<EmployeeDirectoryEntry["role"] | "all">("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const activeEmployees = employees.filter((employee) => employee.active);
  const departmentOptions = Array.from(new Set(employees.map((employee) => employee.role)));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredEmployees = employees.filter((employee) => {
    if (departmentFilter !== "all" && employee.role !== departmentFilter) return false;
    if (statusFilter === "active" && !employee.active) return false;
    if (statusFilter === "inactive" && employee.active) return false;
    return !normalizedQuery || [
      employee.id,
      employee.name,
      workforceTitleByRole[employee.role],
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
  const pageCount = Math.max(1, Math.ceil(filteredEmployees.length / workforcePageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleEmployees = filteredEmployees.slice(
    (currentPage - 1) * workforcePageSize,
    currentPage * workforcePageSize,
  );
  const updateQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };
  const openFilters = (open: boolean) => {
    if (open) {
      setDraftDepartmentFilter(departmentFilter);
      setDraftStatusFilter(statusFilter);
    }
    setFiltersOpen(open);
  };
  const applyFilters = () => {
    setDepartmentFilter(draftDepartmentFilter);
    setStatusFilter(draftStatusFilter);
    setPage(1);
    setFiltersOpen(false);
  };
  const resetFilters = () => {
    setQuery("");
    setDepartmentFilter("all");
    setStatusFilter("all");
    setDraftDepartmentFilter("all");
    setDraftStatusFilter("all");
    setPage(1);
    setFiltersOpen(false);
  };
  const activeFilterCount = Number(departmentFilter !== "all") + Number(statusFilter !== "all");

  return (
    <main className="flex-1 min-w-0 h-full overflow-auto" style={{ backgroundColor: "#F5F7FB" }}>
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-end">
          <div aria-live="polite" className="font-dm text-sm font-semibold text-slate-600">{filteredEmployees.length} employees</div>
        </div>
      </header>

      <section className="mx-auto flex max-w-[1600px] flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
        <section aria-label="Workforce summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: "Total Employees", count: employees.length, icon: Users, color: "text-blue-700", background: "bg-blue-50" },
            { label: "Active Employees", count: activeEmployees.length, icon: UserRound, color: "text-emerald-700", background: "bg-emerald-50" },
          ].map(({ label, count, icon: Icon, color, background }) => (
            <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="font-dm text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${background} ${color}`}><Icon size={18} /></span>
              </div>
              <div className="mt-3 font-syne text-3xl font-bold text-slate-900">{count}</div>
              <p className="mt-2 font-dm text-xs text-slate-500">{label === "Total Employees" ? "Employee accounts in the directory" : "Employees with active system access"}</p>
            </article>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-5 md:flex-row md:items-center">
            <div className="flex w-full min-w-0 items-center gap-2 md:max-w-3xl md:ml-auto">
              <label className="relative min-w-0 flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => updateQuery(event.target.value)}
                  placeholder="Search employee name, ID, or position..."
                  aria-label="Search employees"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 font-dm text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </label>
              <Popover open={filtersOpen} onOpenChange={openFilters}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={activeFilterCount ? `Filter, ${activeFilterCount} active filters` : "Filter"}
                    aria-haspopup="dialog"
                    aria-expanded={filtersOpen}
                    aria-pressed={activeFilterCount > 0}
                    className={`relative inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 font-dm text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
                      activeFilterCount
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <SlidersHorizontal size={16} aria-hidden="true" />
                    Filter
                    {activeFilterCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden="true" />}
                  </button>
                </PopoverTrigger>
                <PopoverContent aria-label="Employee filters" align="end" sideOffset={6} className="data-[state=closed]:hidden w-[min(19rem,calc(100vw-2rem))] rounded-xl border-slate-200 bg-white p-4 shadow-lg">
                  <div className="space-y-3">
                    <label className="block font-dm text-xs font-semibold text-slate-600">
                      Department
                      <select
                        value={draftDepartmentFilter}
                        onChange={(event) => setDraftDepartmentFilter(event.target.value as EmployeeDirectoryEntry["role"] | "all")}
                        aria-label="Filter by department"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                      >
                        <option value="all">All Departments</option>
                        {departmentOptions.map((role) => (
                          <option key={role} value={role}>{workforceTitleByRole[role]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block font-dm text-xs font-semibold text-slate-600">
                      Employment Status
                      <select
                        value={draftStatusFilter}
                        onChange={(event) => setDraftStatusFilter(event.target.value as "all" | "active" | "inactive")}
                        aria-label="Filter by employment status"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                      >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                    <div className="flex justify-between gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={applyFilters}
                        className="rounded-lg bg-red-700 px-3 py-2 font-dm text-xs font-semibold text-white transition-colors hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-50/80">
                <tr>
                  {["Employee ID", "Employee Name", "Assigned Position", "Account Status"].map((heading) => (
                    <th key={heading} className="px-5 py-3 text-left font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => {
                  const initials = employee.name.trim().split(/\s+/).map((part) => part[0]?.toUpperCase() ?? "").slice(0, 2).join("");
                  return (
                    <tr key={employee.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-dm text-xs text-slate-600">{employee.id}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 font-syne text-xs font-bold text-blue-700">{initials}</span>
                          <span className="font-dm text-sm font-semibold text-slate-800">{employee.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 font-dm text-[11px] font-semibold text-slate-700">{workforceTitleByRole[employee.role]}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-dm text-[11px] font-semibold ${employee.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${employee.active ? "bg-emerald-500" : "bg-slate-400"}`} />{employee.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {visibleEmployees.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-14 text-center font-dm text-sm text-slate-500">
                      {employees.length === 0 ? "No employee records available." : "No employees match the current search and filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p aria-live="polite" className="font-dm text-xs text-slate-500">
              {filteredEmployees.length === 0
                ? "Showing 0 employees"
                : `Showing ${(currentPage - 1) * workforcePageSize + 1}–${Math.min(currentPage * workforcePageSize, filteredEmployees.length)} of ${filteredEmployees.length} employees`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="min-w-20 text-center font-dm text-xs text-slate-500">Page {currentPage} of {pageCount}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={currentPage >= pageCount}
                className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export function UserManagementView() {
  const { role } = useSession();
  if (role === "owner") return <EmployeeDirectory />;
  if (role === "admin") return <AdminUserManagementView />;
  return <Unauthorized />;
}

function AdminUserManagementView() {
  const [accounts, setAccounts] = useState<Account[]>(getAccounts);
  const [activeTab, setActiveTab] = useState<AccountType>("employee");
  const [activeView, setActiveView] = useState<"employee" | "client" | "roles">("employee");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AccountRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [draftStatusFilter, setDraftStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [statusFiltersOpen, setStatusFiltersOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Omit<Account, "id" | "joined" | "active">>(newDraft("employee"));
  const [formError, setFormError] = useState("");
  const [confirmation, setConfirmation] = useState<{ account: Account; action: "reset" | "toggle" } | null>(null);

  const activeEmployees = accounts.filter((account) => account.type === "employee" && account.active);
  const registeredClients = accounts.filter((account) => account.type === "client");
  const inactiveAccounts = accounts.filter((account) => !account.active);
  const activeRoleCount = new Set(accessLevels.map((level) => level.id)).size;

  const updateStatusFiltersOpen = (open: boolean) => {
    if (open) setDraftStatusFilter(statusFilter);
    setStatusFiltersOpen(open);
  };
  const applyStatusFilter = () => {
    setStatusFilter(draftStatusFilter);
    setStatusFiltersOpen(false);
  };
  const resetStatusFilter = () => {
    setStatusFilter("all");
    setDraftStatusFilter("all");
    setStatusFiltersOpen(false);
  };

  const visibleAccounts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return accounts.filter((account) => {
      if (account.type !== activeTab) return false;
      if (roleFilter !== "all" && account.role !== roleFilter) return false;
      if (statusFilter === "active" && !account.active) return false;
      if (statusFilter === "inactive" && account.active) return false;
      return !normalizedQuery || [
        account.name,
        account.email,
        account.username,
        account.phone,
        formattedRole(account.role),
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [accounts, activeTab, query, roleFilter, statusFilter]);

  const updateAccounts = (next: Account[]) => {
    saveAccounts(next);
    setAccounts(next);
  };

  const openCreate = () => {
    if (activeView === "roles") return;
    setEditingId(null);
    setShowForm(true);
    setDraft(newDraft(activeTab));
    setFormError("");
  };

  const openEdit = (account: Account) => {
    setEditingId(account.id);
    setShowForm(true);
    setDraft({
      type: account.type,
      name: account.name,
      email: account.email,
      username: account.username,
      phone: account.phone,
      role: account.role,
      password: account.password,
      emailAlerts: account.emailAlerts ?? true,
    });
    setFormError("");
  };

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draft.name.trim();
    const email = draft.email.trim().toLocaleLowerCase();
    const username = draft.username.trim();
    if (!name || !email || !username) {
      setFormError("Name, email, and username are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (!draft.password.trim()) {
      setFormError("Password is required.");
      return;
    }
    const duplicate = accounts.find((account) =>
      account.id !== editingId
      && (account.email.toLocaleLowerCase() === email || account.username.toLocaleLowerCase() === username.toLocaleLowerCase())
    );
    if (duplicate) {
      setFormError(duplicate.email.toLocaleLowerCase() === email
        ? "An account already uses this email address."
        : "An account already uses this username.");
      return;
    }
    if (draft.type === "employee" && draft.role === "client") {
      setFormError("Select a staff role for an employee account.");
      return;
    }

    const updatedDraft = { ...draft, name, email, username, phone: draft.phone.trim() || "—" };
    if (editingId) {
      updateAccounts(accounts.map((account) => account.id === editingId ? { ...account, ...updatedDraft } : account));
      toast.success("Account details updated.");
    } else {
      const account: Account = {
        ...updatedDraft,
        id: crypto.randomUUID(),
        joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        active: true,
      };
      updateAccounts([...accounts, account]);
      toast.success("Account registered.", { description: `Login username: ${username} · temporary password: ${draft.password}` });
    }
    setShowForm(false);
  };

  const resetPassword = (account: Account) => {
    const password = createTemporaryPassword();
    updateAccounts(accounts.map((item) => item.id === account.id ? { ...item, password } : item));
    toast.success("Password reset.", { description: `Temporary password for ${account.username}: ${password}` });
  };

  const toggleActive = (account: Account) => {
    const active = !account.active;
    updateAccounts(accounts.map((item) => item.id === account.id ? { ...item, active } : item));
    toast.success(`${account.name} ${active ? "activated" : "deactivated"}.`);
  };

  const tabCount = (type: AccountType) => accounts.filter((account) => account.type === type).length;

  const switchView = (view: "employee" | "client" | "roles") => {
    setActiveView(view);
    if (view !== "roles") setActiveTab(view);
    setQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  const confirmAction = () => {
    if (!confirmation) return;
    if (confirmation.action === "reset") resetPassword(confirmation.account);
    else toggleActive(confirmation.account);
    setConfirmation(null);
  };

  return (
    <main className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F5F7FB" }}>
      <Toaster position="bottom-right" richColors />
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: "#C8102E", backgroundColor: "#FFF1F2" }}><ShieldCheck size={19} /></span>
              <h1 className="font-syne" style={{ fontSize: 27, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>User Management</h1>
            </div>
            <p className="font-dm ml-11 mt-1" style={{ fontSize: 13, color: "#64748B" }}>Manage access, credentials, and account profiles across your organization.</p>
          </div>
          {activeView !== "roles" && (
            <button
              onClick={openCreate}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-white shadow-sm transition hover:brightness-95"
              style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}
            >
              <Plus size={16} /> Register {activeTab === "employee" ? "Employee" : "Client"}
            </button>
          )}
        </div>
      </header>

      <section className="mx-auto flex max-w-[1600px] flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
        <section aria-label="Account overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="font-dm text-xs font-semibold uppercase tracking-wide text-slate-500">Active employees</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Users size={18} /></span>
            </div>
            <div className="mt-3 font-syne text-3xl font-bold text-slate-900">{activeEmployees.length}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {accessLevels.filter((level) => level.id !== "client").map((role) => {
                const count = activeEmployees.filter((account) => account.role === role.id).length;
                return <span key={role.id} className="rounded-full bg-slate-100 px-2 py-0.5 font-dm text-[10px] font-medium text-slate-600">{role.label} {count}</span>;
              })}
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="font-dm text-xs font-semibold uppercase tracking-wide text-slate-500">Registered clients</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Building2 size={18} /></span>
            </div>
            <div className="mt-3 font-syne text-3xl font-bold text-slate-900">{registeredClients.length}</div>
            <p className="mt-2 font-dm text-xs text-slate-500">Client portal accounts</p>
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="font-dm text-xs font-semibold uppercase tracking-wide text-slate-500">Access action items</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><AlertCircle size={18} /></span>
            </div>
            <div className="mt-3 font-syne text-3xl font-bold text-slate-900">{inactiveAccounts.length}</div>
            <p className="mt-2 font-dm text-xs text-slate-500">Deactivated accounts to review</p>
          </article>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="font-dm text-xs font-semibold uppercase tracking-wide text-slate-500">Access control</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><ShieldCheck size={18} /></span>
            </div>
            <div className="mt-3 flex items-center gap-2 font-syne text-3xl font-bold text-slate-900">{activeRoleCount} <Check size={19} className="text-emerald-600" /></div>
            <p className="mt-2 font-dm text-xs text-slate-500">RBAC roles configured</p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-5 md:flex-row md:items-center">
            <div>
              <h2 className="font-syne text-lg font-bold text-slate-900">Accounts & access</h2>
              <p className="mt-1 font-dm text-xs text-slate-500">Browse and administer account records.</p>
            </div>
            <div role="tablist" aria-label="Account management sections" className="grid grid-cols-1 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-3">
              {([
                { id: "employee" as const, label: "Employees", icon: UserRoundCog },
                { id: "client" as const, label: "Clients", icon: Building2 },
                { id: "roles" as const, label: "Roles & access", icon: ShieldCheck },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={activeView === id}
                  onClick={() => switchView(id)}
                  className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-dm transition-all"
                  style={{ backgroundColor: activeView === id ? "#FFFFFF" : "transparent", color: activeView === id ? "#991B1B" : "#64748B", boxShadow: activeView === id ? "0 1px 3px rgba(15,23,42,0.12)" : "none", fontSize: 12, fontWeight: activeView === id ? 700 : 600 }}
                >
                  <Icon size={15} /> {label}
                  {id !== "roles" && <span className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: activeView === id ? "#FFF1F2" : "#E2E8F0", color: activeView === id ? "#991B1B" : "#475569", fontSize: 10 }}>{tabCount(id)}</span>}
                </button>
              ))}
            </div>
          </div>

          {activeView === "roles" ? (
            <div className="p-4 sm:p-6">
              <div className="mb-5">
                <h3 className="font-syne text-base font-bold text-slate-900">Role Access Matrix</h3>
                <p className="mt-1 font-dm text-xs text-slate-500">Nine configured roles define access across employee workspaces and the client portal.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {accessLevels.map((level) => (
                  <article key={level.id} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 transition hover:border-slate-300 hover:bg-white">
                    <span className="inline-flex rounded-full px-2.5 py-1 font-dm" style={{ fontSize: 10, fontWeight: 700, color: level.fg, backgroundColor: level.bg }}>{level.label}</span>
                    <p className="mt-2 font-dm text-xs leading-relaxed text-slate-500">{level.description}</p>
                  </article>
                ))}
              </div>
              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700"><ShieldCheck size={18} /></span>
                <div>
                  <h4 className="font-dm text-sm font-semibold text-emerald-900">Role-based access control is active</h4>
                  <p className="mt-0.5 font-dm text-xs text-emerald-800">Role assignments are applied at sign-in. Deactivated accounts cannot log in.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
                <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
                  <div>
                    <h3 className="font-syne text-base font-bold text-slate-900">{activeTab === "employee" ? "Employee accounts" : "Client accounts"}</h3>
                    <p className="mt-1 font-dm text-xs text-slate-500">{visibleAccounts.length} result{visibleAccounts.length === 1 ? "" : "s"} · {activeTab === "employee" ? "Manage staff roles and access" : "Manage client portal credentials"}</p>
                  </div>
                </div>
                <div className={activeTab === "employee"
                  ? "flex w-full min-w-0 items-center gap-2"
                  : "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_220px_180px]"
                }>
                  <label className={activeTab === "employee" ? "relative min-w-0 flex-1" : "relative"}>
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search name, email, username..."
                      aria-label={`Search ${activeTab} accounts`}
                      className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 font-dm text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
                    />
                  </label>
                  {activeTab === "employee" ? (
                    <>
                      <Popover open={statusFiltersOpen} onOpenChange={updateStatusFiltersOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={statusFilter !== "all" ? "Filter, account status applied" : "Filter"}
                            aria-haspopup="dialog"
                            aria-expanded={statusFiltersOpen}
                            aria-pressed={statusFilter !== "all"}
                            className={`relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 font-dm text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
                              statusFilter !== "all"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <SlidersHorizontal size={16} aria-hidden="true" />
                            Filter
                            {statusFilter !== "all" && <span className="h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden="true" />}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent aria-label="Account status filters" align="end" sideOffset={6} className="data-[state=closed]:hidden w-[min(18rem,calc(100vw-2rem))] rounded-xl border-slate-200 bg-white p-4 shadow-lg">
                          <div className="space-y-3">
                            <label className="block font-dm text-xs font-semibold text-slate-600">
                              Account Status
                              <select
                                aria-label="Filter by status"
                                value={draftStatusFilter}
                                onChange={(event) => setDraftStatusFilter(event.target.value as "all" | "active" | "inactive")}
                                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                              >
                                <option value="all">All statuses</option>
                                <option value="active">Active</option>
                                <option value="inactive">Deactivated</option>
                              </select>
                            </label>
                            <div className="flex justify-between gap-2 border-t border-slate-100 pt-3">
                              <button
                                type="button"
                                onClick={resetStatusFilter}
                                className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                              >
                                Reset
                              </button>
                              <button
                                type="button"
                                onClick={applyStatusFilter}
                                className="rounded-lg bg-red-700 px-3 py-2 font-dm text-xs font-semibold text-white transition-colors hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                              >
                                Apply Filters
                              </button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as AccountRole | "all")} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50">
                        <option value="all">All roles</option>
                        {accessLevels.filter((level) => level.id !== "client").map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as AccountRole | "all")} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50">
                        <option value="all">All roles</option>
                        {accessLevels.filter((level) => level.id === "client").map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
                      </select>
                      <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50">
                        <option value="all">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Deactivated</option>
                      </select>
                    </>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px]">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {["Account", "Username", ...(activeTab === "employee" ? ["Role"] : ["Phone"]), "Status", "Registered", "Actions"].map((heading) => (
                        <th key={heading} className="px-5 py-3 text-left font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAccounts.map((account) => {
                      const initials = account.name.trim().split(/\s+/).map((part) => part[0]?.toUpperCase() ?? "").slice(0, 2).join("");
                      const roleColor = accessLevels.find((level) => level.id === account.role) ?? accessLevels[0];
                      return (
                        <tr key={account.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-syne text-xs font-bold" style={{ backgroundColor: roleColor.bg, color: roleColor.fg }}>{initials}</span>
                              <span className="min-w-0">
                                <span className="block truncate font-dm text-sm font-semibold text-slate-800">{account.name}</span>
                                <span className="block truncate font-dm text-xs text-slate-500">{account.email}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-dm text-xs text-slate-600">{account.username}</td>
                          <td className="px-5 py-3.5">
                            {activeTab === "employee"
                              ? <span className="inline-flex rounded-full px-2.5 py-1 font-dm text-[11px] font-semibold" style={{ backgroundColor: roleColor.bg, color: roleColor.fg }}>{formattedRole(account.role)}</span>
                              : <span className="font-dm text-xs text-slate-600">{account.phone}</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-dm text-[11px] font-semibold ${account.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${account.active ? "bg-emerald-500" : "bg-slate-400"}`} />{account.active ? "Active" : "Deactivated"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-dm text-xs text-slate-500">{account.joined}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openEdit(account)} title={`Edit profile: ${account.name}`} aria-label={`Edit ${account.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Pencil size={14} /></button>
                              <button onClick={() => setConfirmation({ account, action: "reset" })} title={`Reset credentials: ${account.name}`} aria-label={`Reset password for ${account.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"><KeyRound size={14} /></button>
                              <button onClick={() => setConfirmation({ account, action: "toggle" })} title={`${account.active ? "Deactivate" : "Activate"} account: ${account.name}`} aria-label={`${account.active ? "Deactivate" : "Activate"} ${account.name}`} className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${account.active ? "border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}><Power size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {visibleAccounts.length === 0 && <tr><td colSpan={6} className="px-5 py-14 text-center font-dm text-sm text-slate-500">No accounts match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6" style={{ backgroundColor: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)" }} onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <form onSubmit={saveDraft} className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ boxShadow: "0 24px 80px rgba(15,23,42,0.25)" }}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-5 sm:px-7">
              <div>
                <div className="font-dm text-[11px] font-bold uppercase tracking-widest text-red-700">{draft.type === "employee" ? "Employee account" : "Client portal"}</div>
                <h3 className="mt-1 font-syne text-xl font-bold text-slate-900">{editingId ? "Edit account details" : `Register ${draft.type}`}</h3>
                <p className="mt-1 font-dm text-xs text-slate-500">Complete the profile and access information below.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5 sm:p-7">
              <section>
                <h4 className="mb-3 font-dm text-xs font-bold uppercase tracking-wider text-slate-500">Profile information</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {([
                ["name", "Full name / client name", "text"],
                ["email", "Email", "email"],
                ["username", "Username", "text"],
                ["phone", "Phone", "tel"],
              ] as const).map(([field, label, type]) => (
                <label key={field} className="flex flex-col gap-1.5 font-dm text-xs font-semibold text-slate-600">
                  {label}{field !== "phone" && " *"}
                  <input required={field !== "phone"} type={type} value={draft[field]} onChange={(event) => { setDraft({ ...draft, [field]: event.target.value }); setFormError(""); }} className={`rounded-lg border bg-white px-3 py-2.5 font-dm text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-4 ${formError && field !== "phone" && !draft[field].trim() ? "border-red-300 focus:border-red-400 focus:ring-red-50" : "border-slate-200 focus:border-blue-300 focus:ring-blue-50"}`} />
                </label>
              ))}
                </div>
              </section>
              <section>
                <h4 className="mb-3 font-dm text-xs font-bold uppercase tracking-wider text-slate-500">Access & credentials</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {draft.type === "employee" && (
                <label className="flex flex-col gap-1.5 font-dm text-xs font-semibold text-slate-600">
                  Staff role *
                  <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as StaffRole })} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm text-slate-800 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                    {draft.role === "admin" && <option value="admin">Admin</option>}
                    {staffRoles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
                  </select>
                </label>
              )}
              {editingId && (
                <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/70 p-3 sm:col-span-2">
                  <div>
                    <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#1E3A8A" }}>Email Alerts</div>
                    <div className="font-dm" style={{ fontSize: 11, color: "#1E40AF" }}>Receive notifications for events targeting this role.</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.emailAlerts ?? true}
                    aria-label="Email alerts"
                    onClick={() => setDraft({ ...draft, emailAlerts: !(draft.emailAlerts ?? true) })}
                    className="relative w-12 h-6 rounded-full transition-colors"
                    style={{ backgroundColor: (draft.emailAlerts ?? true) ? "#2563EB" : "#CBD5E1" }}
                  >
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: (draft.emailAlerts ?? true) ? 26 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
              )}
              {!editingId && (
                <label className="font-dm flex flex-col gap-1.5 sm:col-span-2" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Initial password *
                  <input required type="text" value={draft.password} onChange={(event) => { setDraft({ ...draft, password: event.target.value }); setFormError(""); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm font-normal text-slate-800 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                </label>
              )}
                  {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 font-dm text-xs font-medium text-red-700 sm:col-span-2">{formError}</p>}
                </div>
              </section>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-7">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2.5 font-dm text-sm font-semibold text-slate-600 transition hover:bg-slate-200/70">Cancel</button>
              <button type="submit" className="flex items-center gap-2 rounded-lg px-4 py-2.5 font-dm text-sm font-bold text-white shadow-sm transition hover:brightness-95" style={{ backgroundColor: "#C8102E" }}>
                {editingId ? <><Pencil size={14} /> Save changes</> : <><UserRound size={14} /> Register account</>}
              </button>
            </div>
          </form>
        </div>
      )}
      {confirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.55)", backdropFilter: "blur(3px)" }} onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmation(null); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="account-action-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: confirmation.action === "toggle" && confirmation.account.active ? "#FEF2F2" : "#FFFBEB", color: confirmation.action === "toggle" && confirmation.account.active ? "#B91C1C" : "#B45309" }}>
              {confirmation.action === "reset" ? <KeyRound size={19} /> : <Power size={19} />}
            </div>
            <h3 id="account-action-title" className="mt-4 font-syne text-lg font-bold text-slate-900">
              {confirmation.action === "reset" ? "Reset account credentials?" : `${confirmation.account.active ? "Deactivate" : "Activate"} this account?`}
            </h3>
            <p className="mt-2 font-dm text-sm leading-relaxed text-slate-600">
              {confirmation.action === "reset"
                ? `A new temporary password will be generated for ${confirmation.account.name}.`
                : confirmation.account.active
                  ? `${confirmation.account.name} will no longer be able to sign in until the account is activated again.`
                  : `${confirmation.account.name} will be able to sign in again.`}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfirmation(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 font-dm text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Cancel</button>
              <button onClick={confirmAction} className="rounded-lg px-4 py-2.5 font-dm text-sm font-bold text-white transition hover:brightness-95" style={{ backgroundColor: confirmation.action === "toggle" && confirmation.account.active ? "#B91C1C" : "#C8102E" }}>Confirm</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
