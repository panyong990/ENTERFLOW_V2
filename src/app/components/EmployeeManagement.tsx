import {api,accountFromRow,adminChanged,type DirectoryRow} from "../api/client";
import {useDirectory} from "./admin/useDirectory";
import {AdminFeedback} from "./admin/AdminFeedback";
import {AdminDialog} from "./admin/AdminDialog";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Eye, KeyRound, Pencil, Power, Search, SlidersHorizontal, UserRoundCog, X, type LucideIcon } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { roleMetas } from "./Login";
import { getAccounts, hashPassword, saveAccounts, type Account, type AccountRole } from "../store/accounts";
import { useSession } from "../store/session";
import { Unauthorized } from "./Unauthorized";

const pageSize = 10;
const assignableRoles = (Object.keys(roleMetas) as AccountRole[]).filter((role) => role !== "admin" && role !== "client");
const roleNames: Record<AccountRole, string> = {
  admin: roleMetas.admin.label,
  owner: roleMetas.owner.label,
  operations: roleMetas.operations.label,
  sales: roleMetas.sales.label,
  accounting: roleMetas.accounting.label,
  production: roleMetas.production.label,
  warehouse: roleMetas.warehouse.label,
  logistics: roleMetas.logistics.label,
  client: roleMetas.client.label,
};

type EmployeeAccount = Account & { type: "employee"; role: Exclude<AccountRole, "client"> };

function isEmployeeAccount(account: Account): account is EmployeeAccount {
  return account.type === "employee" && account.role !== "client";
}

interface EmployeeDraft {
  employeeId: string;
  name: string;
  department: string;
  jobTitle: string;
  email: string;
  username: string;
  phone: string;
  role: AccountRole;
  initialPassword: string;
}

const emptyDraft: EmployeeDraft = {
  employeeId: "",
  name: "",
  department: "",
  jobTitle: "",
  email: "",
  username: "",
  phone: "",
  role: "sales",
  initialPassword: "",
};

interface EmployeeFilters {
  department: string;
  role: AccountRole | "all";
  status: "all" | "active" | "inactive";
}

function IconActionButton({ icon: Icon, label, onClick, className, disabled = false }: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button disabled={disabled} type="button" onClick={onClick} aria-label={label} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 ${className}`}>
          <Icon size={15} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function EmployeeManagement() {
  const { role } = useSession();
  if (role !== "admin") return <Unauthorized />;
  return <EmployeeManagementPage />;
}

function EmployeeManagementPage() {
  const {mode,userId}=useSession();const real=mode==='real';
  const mutation=useRef(false);const [formError,setFormError]=useState('');const [blocked,setBlocked]=useState(false);const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});

  const [accounts, setAccounts] = useState<Account[]>(()=>real?[]:getAccounts());
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState<AccountRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [draftFilters, setDraftFilters] = useState<EmployeeFilters>({ department: "all", role: "all", status: "all" });
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<EmployeeAccount | null>(null);
  const [editing, setEditing] = useState<EmployeeAccount | null>(null);
  const [resetting, setResetting] = useState<EmployeeAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<EmployeeDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const remote=useDirectory(real,'employees',{q:query,department:departmentFilter,role:roleFilter,status:statusFilter,page,pageSize});
  useEffect(()=>{if(real&&remote.data)setAccounts(remote.data.items.map(row=>accountFromRow(row,'employee')));},[real,remote.data]);
  const employees = useMemo(() => accounts.filter(isEmployeeAccount), [accounts]);
  const departments = useMemo(() => real?remote.data?.summary?.departments??[]:Array.from(new Set(employees.map((employee) => employee.department?.trim()).filter((department): department is string => Boolean(department)))).sort(), [employees,real,remote.data]);
  const filteredEmployees = useMemo(() => {
    if(real)return employees;
    const term = query.trim().toLocaleLowerCase();
    return employees.filter((employee) => {
      if (departmentFilter === "__unspecified" && employee.department?.trim()) return false;
      if (departmentFilter !== "all" && departmentFilter !== "__unspecified" && (employee.department || "") !== departmentFilter) return false;
      if (roleFilter !== "all" && employee.role !== roleFilter) return false;
      if (statusFilter === "active" && !employee.active) return false;
      if (statusFilter === "inactive" && employee.active) return false;
      return !term || [
        employee.employeeId || employee.id,
        employee.name,
        employee.department || "",
        employee.jobTitle || "",
        roleNames[employee.role],
        employee.email,
      ].some((value) => value.toLocaleLowerCase().includes(term));
    });
  }, [employees, query, departmentFilter, roleFilter, statusFilter,real]);
  const pageCount = Math.max(1, Math.ceil((real?remote.data?.total??0:filteredEmployees.length) / pageSize));
  const currentPage = real?remote.data?.page??1:Math.min(page, pageCount);
  const total=real?remote.data?.total??0:filteredEmployees.length;
  const visibleEmployees = real?filteredEmployees:filteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeEmployeeCount = real?remote.data?.summary?.active??0:employees.filter((employee) => employee.active).length;
  const activeFilterCount = Number(departmentFilter !== "all") + Number(roleFilter !== "all") + Number(statusFilter !== "all");
  const hasDirectoryCriteria = Boolean(query.trim()) || departmentFilter !== "all" || roleFilter !== "all" || statusFilter !== "all";
  const availableRoles: AccountRole[] = real?["admin",...assignableRoles]:assignableRoles.filter((role) => employees.some((employee) => employee.role === role));
  if (!real&&employees.some((employee) => employee.role === "admin")) availableRoles.unshift("admin");

  const updateAccounts = (next: Account[]) => {
    if(real)throw new Error("Local persistence is disabled in Real Mode.");
    saveAccounts(next);
    setAccounts(next);
  };
  const beginAdd = () => {
    setFormError('');setBlocked(false);setFieldErrors({});
    setDraft(emptyDraft);
    setShowAdd(true);
  };
  const beginEdit = (employee: EmployeeAccount) => {
    if(real&&employee.role==='admin'&&employee.id!==userId){toast.error("Other Admin accounts are protected.");return;}
    setFormError('');setBlocked(false);setFieldErrors({});
    setSelected(null);
    setEditing(employee);
    setDraft({
      employeeId: employee.employeeId || employee.id,
      name: employee.name,
      department: employee.department || "",
      jobTitle: employee.jobTitle || "",
      email: employee.email,
      username: employee.username,
      phone: employee.phone === "—" ? "" : employee.phone,
      role: employee.role,
      initialPassword: "",
    });
  };
  const submitEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if(mutation.current||blocked)return;
    const employeeId = draft.employeeId.trim();
    const name = draft.name.trim();
    const department = draft.department.trim();
    const jobTitle = draft.jobTitle.trim();
    const email = draft.email.trim().toLocaleLowerCase();
    const username = draft.username.trim();
    const phone = draft.phone.trim() || "—";
    const permittedRole = assignableRoles.includes(draft.role as Exclude<AccountRole, "admin" | "client">)
      || (editing?.role === "admin" && draft.role === "admin");
    if (!employeeId || !name || !department || !jobTitle || !email || !username || !permittedRole) {
      toast.error("Employee ID, name, department, job title, email, username, and an allowed system role are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!editing && draft.initialPassword.length < 8) {
      toast.error("Set an initial password with at least 8 characters.");
      return;
    }
    const id = editing?.id;
    const duplicateId = employees.find((employee) => employee.id !== id && (employee.employeeId || employee.id).toLocaleLowerCase() === employeeId.toLocaleLowerCase());
    const duplicateAccount = accounts.find((account) => account.id !== id && (
      account.email.toLocaleLowerCase() === email
      || account.username.toLocaleLowerCase() === username.toLocaleLowerCase()
    ));
    if (duplicateId || duplicateAccount) {
      toast.error(duplicateId ? "That employee ID is already in use." : "An account already uses this email address or username.");
      return;
    }
    mutation.current=true;setSaving(true);setFormError('');
    let profileSaved=false;
    try {
      if(real){
        const body={employeeId,name,department,jobTitle,email,username,phone:draft.phone.trim()};
        if(editing){
          const saved=await api<DirectoryRow>(`/api/admin/employees/${editing.id}`,{method:'PATCH',body:{...body,revision:editing.revision}});
          profileSaved=true;
          if(draft.role!==editing.role)await api(`/api/admin/employees/${editing.id}/role`,{method:'POST',body:{roleCode:draft.role,revision:saved.revision}});
        }else await api('/api/admin/employees',{method:'POST',body:{...body,roleCode:draft.role,initialPassword:draft.initialPassword}});
        adminChanged();setEditing(null);setShowAdd(false);setDraft(emptyDraft);toast.success('Employee saved.');return;
      }
      let passwordHash = editing?.passwordHash;
      if (!editing) passwordHash = await hashPassword(draft.initialPassword);
      const changedFields = {
        employeeId,
        name,
        department,
        jobTitle,
        email,
        username,
        phone,
        role: draft.role as Exclude<AccountRole, "client">,
      };
      if (editing) {
        updateAccounts(accounts.map((account) => account.id === editing.id ? { ...account, ...changedFields } : account));
        toast.success("Employee details and access settings updated.");
      } else {
        const newAccount: Account = {
          ...changedFields,
          id: crypto.randomUUID(),
          type: "employee",
          passwordHash,
          joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          active: true,
          emailAlerts: true,
        };
        updateAccounts([...accounts, newAccount]);
        toast.success("Employee account created. The initial password is not stored in plaintext.");
      }
      setEditing(null);
      setSelected(null);
      setShowAdd(false);
      setDraft(emptyDraft);
    } catch (cause) {
      const message=(profileSaved?'Profile saved, but the role change was not confirmed. These are separate operations. ':'')+((cause as {errors?:Record<string,string>}).errors?Object.values((cause as {errors:Record<string,string>}).errors).join(' '):cause instanceof Error?cause.message:'Unable to save the employee account.');
      setFormError(message);setFieldErrors((cause as {errors?:Record<string,string>}).errors??{});toast.error(message);if(real){setBlocked(true);adminChanged();}
    } finally {
      mutation.current=false;setSaving(false);
    }
  };
  const toggleEmployee = async (employee: EmployeeAccount) => {
    if(mutation.current)return;
    if(real&&(employee.role==='admin'||employee.id===userId)){toast.error('This account is protected.');return;}
    const active = !employee.active;
    const action = active ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} system access for ${employee.name}?`)) return;
    mutation.current=true;setSaving(true);
    try {
      if(real){await api(`/api/admin/employees/${employee.id}/${action}`,{method:'POST',body:{revision:employee.revision}});setSelected(null);adminChanged();toast.success(`Employee access ${action}d.`);return;}
      updateAccounts(accounts.map((account) => account.id === employee.id ? { ...account, active } : account));
      if (selected?.id === employee.id) setSelected({ ...employee, active });
      toast.success(`${employee.name} system access ${active ? "activated" : "deactivated"}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : `Unable to ${action} employee access.`);if(real){setSelected(null);remote.refresh();}
    } finally {mutation.current=false;setSaving(false);}
  };
  const resetEmployeePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (real||!resetting) return;
    if (newPassword.length < 8) {
      toast.error("Set a password with at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      const passwordHash = await hashPassword(newPassword);
      updateAccounts(accounts.map((account) => {
        if (account.id !== resetting.id) return account;
        const { password: _legacyPassword, ...accountWithoutPlaintextPassword } = account;
        return { ...accountWithoutPlaintextPassword, passwordHash };
      }));
      setResetting(null);
      setNewPassword("");
      toast.success("Password updated. No plaintext password was stored or displayed.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to reset the employee password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 min-w-0 h-full overflow-auto" style={{ backgroundColor: "#F5F7FB" }}>
      <Toaster position="bottom-right" richColors />
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: "#C8102E", backgroundColor: "#FFF1F2" }}><UserRoundCog size={19} /></span>
              <h1 className="font-syne" style={{ fontSize: 27, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Employee Management</h1>
            </div>
            <p className="font-dm ml-11 mt-1" style={{ fontSize: 13, color: "#64748B" }}>Manage employee profiles, assigned roles, and system access.</p>
          </div>
          <button type="button" disabled={saving} onClick={beginAdd} className="flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-white shadow-sm hover:brightness-95" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>Add Employee</button>
        </div>
      </header>
      <section className="mx-auto flex max-w-[1600px] flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
        {real&&<AdminFeedback loading={remote.loading} error={remote.error} retry={remote.refresh} />}
        {real&&<button disabled={remote.loading||saving} onClick={remote.refresh} className="self-end rounded-lg border bg-white px-3 py-2 text-xs">Refresh employees</button>}
        <section aria-label="Workforce summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: "Total Employees", count: real?remote.data?.summary?.total??0:employees.length, icon: UserRoundCog, color: "text-blue-700", background: "bg-blue-50", description: "Employee accounts in the directory" },
            { label: "Active Employees", count: activeEmployeeCount, icon: Power, color: "text-emerald-700", background: "bg-emerald-50", description: "Employees with active system access" },
          ].map(({ label, count, icon: Icon, color, background, description }) => (
            <article key={label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="font-dm text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${background} ${color}`}><Icon size={18} /></span>
              </div>
              <div className="mt-3 font-syne text-3xl font-bold text-slate-900">{real&&!remote.data?"—":count}</div>
              <p className="mt-2 font-dm text-xs text-slate-500">{description}</p>
            </article>
          ))}
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-5">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div className="flex w-full min-w-0 items-center gap-2 md:max-w-3xl md:ml-auto">
                <label className="relative min-w-0 flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search employee name, ID, department, or role..." aria-label="Search employees" className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 font-dm text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:ring-4 focus:ring-red-50" />
                </label>
                <Popover open={filterOpen} onOpenChange={(open) => {
                  if (open) setDraftFilters({ department: departmentFilter, role: roleFilter, status: statusFilter });
                  setFilterOpen(open);
                }}>
                  <PopoverTrigger asChild>
                    <button type="button" aria-label={activeFilterCount ? `Filter, ${activeFilterCount} active filters` : "Filter"} aria-haspopup="dialog" aria-expanded={filterOpen} aria-pressed={activeFilterCount > 0}
                      className={`relative inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 font-dm text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${activeFilterCount ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                      <SlidersHorizontal size={16} aria-hidden="true" />
                      Filter
                      {activeFilterCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden="true" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent aria-label="Employee filters" align="end" sideOffset={6} className="data-[state=closed]:hidden w-[min(19rem,calc(100vw-2rem))] rounded-xl border-slate-200 bg-white p-4 shadow-lg">
                    <div className="space-y-3">
                      <label className="block font-dm text-xs font-semibold text-slate-600">Department
                        <select aria-label="Filter by department" value={draftFilters.department} onChange={(event) => setDraftFilters({ ...draftFilters, department: event.target.value })} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50">
                          <option value="all">All Departments</option>
                          <option value="__unspecified">Unspecified Department</option>
                          {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                        </select>
                      </label>
                      <label className="block font-dm text-xs font-semibold text-slate-600">System role
                        <select aria-label="Filter by system role" value={draftFilters.role} onChange={(event) => setDraftFilters({ ...draftFilters, role: event.target.value as AccountRole | "all" })} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50">
                          <option value="all">All System Roles</option>
                          {availableRoles.map((role) => <option key={role} value={role}>{roleNames[role]}</option>)}
                        </select>
                      </label>
                      <label className="block font-dm text-xs font-semibold text-slate-600">Account status
                        <select aria-label="Filter by account status" value={draftFilters.status} onChange={(event) => setDraftFilters({ ...draftFilters, status: event.target.value as typeof statusFilter })} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50">
                          <option value="all">All Statuses</option>
                          <option value="active">Active</option>
                          <option value="inactive">Deactivated</option>
                        </select>
                      </label>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-slate-100 pt-3">
                      <button type="button" onClick={() => {
                        const resetFilters: EmployeeFilters = { department: "all", role: "all", status: "all" };
                        setDraftFilters(resetFilters);
                        setDepartmentFilter(resetFilters.department);
                        setRoleFilter(resetFilters.role);
                        setStatusFilter(resetFilters.status);
                        setPage(1);
                        setFilterOpen(false);
                      }} className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Reset</button>
                      <button type="button" onClick={() => {
                        setDepartmentFilter(draftFilters.department);
                        setRoleFilter(draftFilters.role);
                        setStatusFilter(draftFilters.status);
                        setPage(1);
                        setFilterOpen(false);
                      }} className="rounded-lg bg-red-700 px-3 py-2 font-dm text-xs font-semibold text-white transition-colors hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Apply Filters</button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] table-fixed">
              <colgroup>
                <col className="w-[10%]" /><col className="w-[14%]" /><col className="w-[10%]" /><col className="w-[10%]" />
                <col className="w-[13%]" /><col className="w-[14%]" /><col className="w-[13%]" /><col className="w-[16%]" />
              </colgroup>
              <thead className="bg-slate-50/80"><tr>{["Employee ID", "Employee Name", "Department", "Job Title", "System Role", "Email Address", "Account Status", "Actions"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3 text-left font-dm text-[11px] font-bold uppercase tracking-wider text-slate-500">{heading}</th>)}</tr></thead>
              <tbody>
                {visibleEmployees.map((employee) => <tr key={employee.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td title={employee.employeeId || employee.id} className="whitespace-nowrap px-3 py-3.5 align-middle font-dm text-xs text-slate-600">{employee.employeeId || employee.id}</td>
                  <td className="px-3 py-3.5 align-middle"><div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 font-syne text-[10px] font-bold text-blue-700">{employee.name.trim().split(/\s+/).map((part) => part[0]?.toUpperCase() ?? "").slice(0, 2).join("")}</span>
                    <span title={employee.name} className="min-w-0 truncate font-dm text-sm font-semibold text-slate-800">{employee.name}</span>
                  </div></td>
                  <td title={employee.department || "—"} className="truncate whitespace-nowrap px-3 py-3.5 align-middle font-dm text-xs text-slate-600">{employee.department || "—"}</td>
                  <td title={employee.jobTitle || "—"} className="truncate whitespace-nowrap px-3 py-3.5 align-middle font-dm text-xs text-slate-600">{employee.jobTitle || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 align-middle"><span className="inline-flex max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 font-dm text-[11px] font-semibold text-slate-700" style={{ backgroundColor: roleMetas[employee.role].bg, color: roleMetas[employee.role].fg }}>{roleNames[employee.role]}</span></td>
                  <td title={employee.email || "—"} className="truncate whitespace-nowrap px-3 py-3.5 align-middle font-dm text-xs text-slate-600">{employee.email || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 align-middle"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-dm text-[11px] font-semibold ${employee.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${employee.active ? "bg-emerald-500" : "bg-slate-400"}`} />{employee.active ? "Active" : "Deactivated"}</span></td>
                  <td className="px-3 py-3.5 align-middle"><div className="flex items-center gap-1">
                    <IconActionButton disabled={saving||(real&&(remote.loading||!!remote.error))} icon={Eye} label={`View ${employee.name}`} onClick={async () => {try{setSelected(real?accountFromRow(await api<DirectoryRow>(`/api/admin/employees/${employee.id}`),'employee') as EmployeeAccount:employee);}catch(cause){toast.error((cause as Error).message);}}} className="text-slate-500 hover:bg-slate-50" />
                    <IconActionButton disabled={saving||(real&&(remote.loading||!!remote.error||(employee.role==='admin'&&employee.id!==userId)))} icon={Pencil} label={`Edit ${employee.name}`} onClick={() => beginEdit(employee)} className="text-slate-500 hover:bg-blue-50 hover:text-blue-700" />
                    <IconActionButton disabled={saving} icon={KeyRound} label={`Reset password for ${employee.name}`} onClick={() => { if(real){toast.info("Password reset is not yet available in Real Mode.");return;}setResetting(employee); setNewPassword(""); }} className="text-slate-500 hover:bg-amber-50 hover:text-amber-700" />
                    <IconActionButton disabled={saving||(real&&(remote.loading||!!remote.error||employee.role==='admin'||employee.id===userId))} icon={Power} label={`${employee.active ? "Deactivate" : "Activate"} ${employee.name}`} onClick={() => void toggleEmployee(employee)} className="text-slate-500 hover:bg-red-50 hover:text-red-700" />
                  </div></td>
                </tr>)}
                {visibleEmployees.length === 0 && (!real||(!remote.loading&&!remote.error)) && <tr><td colSpan={8} className="px-5 py-14 text-center font-dm text-sm text-slate-500">{hasDirectoryCriteria ? "No employees match the current search and filters." : "No employee accounts are available."}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p aria-live="polite" className="font-dm text-xs text-slate-500">{real&&!remote.data?"Employee records have not loaded.":total === 0 ? "Showing 0 employees" : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total} employees`}</p>
            <div className="flex items-center gap-2"><button type="button" onClick={() => setPage(Math.max(1,currentPage-1))} disabled={currentPage <= 1||saving||(real&&remote.loading)} className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Previous</button><span className="min-w-20 text-center font-dm text-xs text-slate-500">Page {currentPage} of {pageCount}</span><button type="button" onClick={() => setPage(Math.min(pageCount,currentPage+1))} disabled={currentPage >= pageCount||saving||(real&&remote.loading)} className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold text-slate-700 enabled:hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Next</button></div>
          </div>
        </section>
      </section>

      {(showAdd || editing) && <AdminDialog title={editing?"Edit employee":"Add Employee"} busy={saving} wide onClose={()=>{setShowAdd(false);setEditing(null);setDraft(emptyDraft);}}><form onSubmit={submitEmployee} aria-describedby={formError?"employee-form-error":undefined}>
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5"><div><p className="font-dm text-xs font-bold uppercase tracking-widest text-red-700">Employee profile</p><h2 className="mt-1 font-syne text-xl font-bold text-slate-900">{editing ? "Edit employee" : "Add Employee"}</h2><p className="mt-1 font-dm text-xs text-slate-500">Role and account access are separate from employee profile information.</p></div><button type="button" disabled={saving} onClick={() => { setShowAdd(false); setEditing(null); }} aria-label="Close form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <section><h3 className="font-syne text-sm font-bold text-slate-800">Employee information</h3><div className="mt-3 grid gap-3">
              {([
                ["Employee ID", "employeeId"], ["Employee name", "name"], ["Department", "department"], ["Job title", "jobTitle"], ["Email address", "email"], ["Username", "username"], ["Contact number", "phone"],
              ] as const).map(([label, field]) => <label key={field} className="font-dm text-xs font-semibold text-slate-600">{label}<input aria-invalid={Boolean(fieldErrors[field])} aria-describedby={fieldErrors[field]?`employee-error-${field}`:undefined} required={field !== "phone"} type={field === "email" ? "email" : field === "phone" ? "tel" : "text"} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-red-300" />{fieldErrors[field]&&<span id={`employee-error-${field}`} className="mt-1 block text-red-700">{fieldErrors[field]}</span>}</label>)}
              {!editing && <label className="font-dm text-xs font-semibold text-slate-600">Initial password<input required minLength={8} type="password" aria-invalid={Boolean(fieldErrors.initialPassword)} autoComplete="new-password" value={draft.initialPassword} onChange={(event) => setDraft({ ...draft, initialPassword: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-red-300" /><span className="mt-1 block font-normal text-slate-500">{fieldErrors.initialPassword??"Only a salted password hash is saved;"} the password is never shown after creation.</span></label>}
            </div></section>
            <section><h3 className="font-syne text-sm font-bold text-slate-800">System access</h3><label className="mt-3 block font-dm text-xs font-semibold text-slate-600">Assigned system role<select disabled={real&&editing?.id===userId} required value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as AccountRole })} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-red-300">{editing?.role === "admin" && <option value="admin">Admin (existing assignment)</option>}{assignableRoles.map((role) => <option key={role} value={role}>{roleNames[role]}</option>)}</select></label>
              {editing && <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-dm text-xs font-bold uppercase tracking-wide text-slate-500">Account status</p><p className="mt-1 font-dm text-sm text-slate-800">{editing.active ? "Active system access" : "Deactivated system access"}</p><p className="mt-1 font-dm text-xs text-slate-500">Change access separately using the account action after saving profile changes.</p></div>}
              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4"><p className="font-dm text-xs font-semibold text-amber-900">Password setup</p><p className="mt-1 font-dm text-xs leading-relaxed text-amber-800">{real?"Initial passwords are hashed on the server. Password reset and invitations are not yet available.":"Demo passwords are hashed locally and are not sent to the real backend."}</p></div>
            </section>
          </div>
          {formError&&<div id="employee-form-error" role="alert" className="mx-6 mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{formError}{blocked&&editing&&<button type="button" className="mt-2 block rounded border p-2" onClick={async()=>{try{const current=await api<DirectoryRow>(`/api/admin/employees/${editing.id}`);beginEdit(accountFromRow(current,'employee') as EmployeeAccount);}catch(cause){setFormError((cause as Error).message);}}}>Reload current employee</button>}{blocked&&!editing&&<p>Refresh the directory and check for this employee before opening a new creation form.</p>}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4"><button type="button" disabled={saving} onClick={() => { setShowAdd(false); setEditing(null); }} className="rounded-lg border border-slate-200 px-4 py-2.5 font-dm text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving||blocked} className="rounded-lg bg-red-700 px-4 py-2.5 font-dm text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : editing ? "Save changes" : "Create employee"}</button></div>
        </form></AdminDialog>}

      {selected && <AdminDialog title="Employee details" busy={saving} onClose={()=>setSelected(null)}>
          <div className="flex items-start justify-between"><div><p className="font-dm text-xs font-bold uppercase tracking-widest text-red-700">Employee account</p><h2 className="mt-1 font-syne text-xl font-bold text-slate-900">{selected.name}</h2></div><button type="button" disabled={saving} onClick={() => setSelected(null)} aria-label="Close details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{[["Employee ID", selected.employeeId || selected.id], ["Department", selected.department || "—"], ["Job title", selected.jobTitle || "—"], ["System role", roleNames[selected.role]], ["Email address", selected.email], ["Username", selected.username], ["Contact number", selected.phone || "—"], ["Account status", selected.active ? "Active" : "Deactivated"]].map(([label, value]) => <div key={label}><dt className="font-dm text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-dm text-sm text-slate-800">{value}</dd></div>)}</dl>
          <div className="mt-6 flex justify-end gap-2"><button type="button" disabled={saving||(real&&selected.role==='admin'&&selected.id!==userId)} onClick={() => beginEdit(selected)} className="rounded-lg border border-slate-200 px-4 py-2.5 font-dm text-sm font-semibold text-slate-700">Edit details</button><button type="button" disabled={saving||(real&&(selected.role==='admin'||selected.id===userId))} onClick={() => void toggleEmployee(selected)} className="rounded-lg bg-red-700 px-4 py-2.5 font-dm text-sm font-bold text-white">{selected.active ? "Deactivate" : "Activate"} access</button></div>
      </AdminDialog>}
      {resetting && !real && <AdminDialog title="Set a new demo password" busy={saving} onClose={()=>setResetting(null)}><form onSubmit={resetEmployeePassword}>
          <h2 className="font-syne text-xl font-bold text-slate-900">Set a new password</h2><p className="mt-1 font-dm text-sm text-slate-500">For {resetting.name}. The password will be stored as a salted hash.</p>
          <label className="mt-5 block font-dm text-xs font-semibold text-slate-600">New password<input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-red-300" /></label>
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setResetting(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 font-dm text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-red-700 px-4 py-2.5 font-dm text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Update password"}</button></div>
        </form></AdminDialog>}
    </main>
  );
}
