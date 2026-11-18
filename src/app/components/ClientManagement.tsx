import {api,accountFromRow,adminChanged,type DirectoryRow} from "../api/client";
import {useDirectory} from "./admin/useDirectory";
import {AdminFeedback} from "./admin/AdminFeedback";
import {AdminDialog} from "./admin/AdminDialog";
import {RegistrationRequests} from "./admin/RegistrationRequests";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Building2, Eye, Pencil, Power, Search, SlidersHorizontal } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  getAccounts,
  hashPassword,
  saveAccounts,
  type Account,
} from "../store/accounts";
import { useSession } from "../store/session";
import { Unauthorized } from "./Unauthorized";

const pageSize = 10;
type ClientAccount = Account & { type: "client"; role: "client" };
type ClientSort = "name-asc" | "name-desc" | "id-asc" | "id-desc";

function isClientAccount(account: Account): account is ClientAccount {
  return account.type === "client" && account.role === "client";
}

function statusClass(active: boolean) {
  return active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500";
}

export function ClientManagement({initialTab="directory"}:{initialTab?:"directory"|"requests"}) {
  const { role } = useSession();
  if (role !== "admin") return <Unauthorized />;
  return <ClientManagementPage initialTab={initialTab} />;
}

function ClientManagementPage({initialTab}:{initialTab:"directory"|"requests"}) {
  const real=useSession().mode==='real';
  const [tab,setTab]=useState(initialTab);
  const mutation=useRef(false);
  const [formError,setFormError]=useState('');const [blocked,setBlocked]=useState(false);const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const [accounts, setAccounts] = useState<Account[]>(()=>real?[]:getAccounts());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<ClientSort>("name-asc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftSort, setDraftSort] = useState<ClientSort>(sort);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ClientAccount | null>(null);
  const [editing, setEditing] = useState<ClientAccount | null>(null);
  const [resetting, setResetting] = useState<ClientAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: "", contactPerson: "", email: "", username: "", phone: "" });

  const remote=useDirectory(real,'clients',{q:query,status,sort,page,pageSize});
  const directoryRefreshRef = useRef(remote.refresh);
  directoryRefreshRef.current = remote.refresh;
  useEffect(() => {
    if (!real) return;

    const update = () => {
      if (document.visibilityState !== "visible" || mutation.current) return;
      void directoryRefreshRef.current();
    };

    const visibility = () => {
      if (document.visibilityState === "visible") update();
    };

    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [real]);
  useEffect(()=>{if(real&&remote.data)setAccounts(remote.data.items.map(row=>accountFromRow(row,'client')));},[real,remote.data]);
  useEffect(()=>{if(real)return;const refresh=()=>setAccounts(getAccounts());window.addEventListener('enterflow:admin-changed',refresh);return()=>window.removeEventListener('enterflow:admin-changed',refresh);},[real]);
  const clients = useMemo(() => accounts.filter(isClientAccount), [accounts]);
  const filteredClients = useMemo(() => {
    if(real)return clients;
    const term = query.trim().toLocaleLowerCase();
    const filtered = clients.filter((client) => {
      if (status === "active" && !client.active) return false;
      if (status === "inactive" && client.active) return false;
      return !term || [client.name, client.id, client.email].some((value) => value.toLocaleLowerCase().includes(term));
    });
    const direction = sort.endsWith("desc") ? -1 : 1;
    const field = sort.startsWith("name") ? "name" : "id";
    return filtered.sort((a, b) => direction * a[field].localeCompare(b[field], undefined, { numeric: true, sensitivity: "base" }));
  }, [clients, query, sort, status,real]);
  const pageCount = Math.max(1, Math.ceil((real?remote.data?.total??0:filteredClients.length) / pageSize));
  const currentPage = real?remote.data?.page??1:Math.min(page, pageCount);
  const total=real?remote.data?.total??0:filteredClients.length;
  const visibleRows = real?filteredClients:filteredClients.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasDirectoryCriteria = Boolean(query.trim()) || status !== "all";

  const updateAccounts = (next: Account[]) => {
    if(real)throw new Error("Local persistence is disabled in Real Mode.");
    saveAccounts(next);
    setAccounts(next);
  };
  const applyClientFilters = () => {
    setStatus(draftStatus);
    setSort(draftSort);
    setPage(1);
    setFilterOpen(false);
  };
  const resetClientFilters = () => {
    setDraftStatus("all");
    setDraftSort("name-asc");
    setStatus("all");
    setSort("name-asc");
    setPage(1);
    setFilterOpen(false);
  };
  const beginEdit = (client: ClientAccount) => {
    if(real&&!client.accountId){toast.error("This company has no portal account.");return;}
    setFormError('');setBlocked(false);setFieldErrors({});
    setSelected(null);
    setEditing(client);
    setDraft({
      name: client.name,
      contactPerson: client.contactPerson ?? "",
      email: client.email,
      username: client.username,
      phone: client.phone === "—" ? "" : client.phone,
    });
  };
  const saveClientDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing||mutation.current||blocked) return;
    const name = draft.name.trim();
    const email = draft.email.trim().toLocaleLowerCase();
    const username = draft.username.trim();
    if (!name || !email || !username || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Company name, valid email, and username are required.");
      return;
    }
    const duplicate = accounts.find((account) => account.id !== editing.id && (
      account.email.toLocaleLowerCase() === email
      || account.username.toLocaleLowerCase() === username.toLocaleLowerCase()
    ));
    if (duplicate) {
      toast.error("Another account already uses this email address or username.");
      return;
    }
    mutation.current=true;setSaving(true);setFormError('');
    try {
      if(real){
        await api(`/api/admin/clients/${editing.id}`,{method:'PATCH',body:{companyName:name,contactPerson:draft.contactPerson.trim(),email,username,phone:draft.phone.trim(),revision:editing.revision}});
        setSelected(null);setEditing(null);adminChanged();toast.success('Client details updated.');return;
      }
      updateAccounts(accounts.map((account) => account.id === editing.id
        ? { ...account, name, email, username, phone: draft.phone.trim() || "—", contactPerson: draft.contactPerson.trim() }
        : account));
      setSelected(null);
      setEditing(null);
      toast.success("Client details updated.");
    } catch (cause) {
      const message=(cause as {errors?:Record<string,string>}).errors?Object.values((cause as {errors:Record<string,string>}).errors).join(" "):cause instanceof Error?cause.message:"Unable to save client details.";setFormError(message);setFieldErrors((cause as {errors?:Record<string,string>}).errors??{});toast.error(message);if(real){setBlocked(true);remote.refresh();}
    } finally {mutation.current=false;setSaving(false);}
  };
  const toggleClient = async (client: ClientAccount) => {
    if(mutation.current)return;
    if(real&&!client.accountId){toast.error("This company has no portal account.");return;}
    const action = client.active ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} access for ${client.name}?`)) return;
    mutation.current=true;setSaving(true);
    try {
      if(real){await api(`/api/admin/clients/${client.id}/${action}`,{method:'POST',body:{revision:client.revision}});setSelected(null);adminChanged();toast.success(`Client access ${action}d.`);return;}
      updateAccounts(accounts.map((account) => account.id === client.id ? { ...account, active: !client.active } : account));
      if (selected?.id === client.id) setSelected({ ...client, active: !client.active });
      toast.success(`${client.name} ${client.active ? "deactivated" : "activated"}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : `Unable to ${action} client access.`);if(real){setSelected(null);remote.refresh();}
    } finally {mutation.current=false;setSaving(false);}
  };
  const resetClientPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetting) return;
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
      toast.error(cause instanceof Error ? cause.message : "Unable to reset the client password.");
    } finally {
      setSaving(false);
    }
  };
  const openDetails = async (client: ClientAccount) => {
    if(mutation.current)return;
    try {setSelected(real?accountFromRow(await api<DirectoryRow>(`/api/admin/clients/${client.id}`),'client') as ClientAccount:client);}catch(cause){toast.error((cause as Error).message);}
    setEditing(null);
  };

  return (
    <main className="flex-1 min-w-0 h-full overflow-auto" style={{ backgroundColor: "#F5F7FB" }}>
      <Toaster position="bottom-right" richColors />
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: "#C8102E", backgroundColor: "#FFF1F2" }}><Building2 size={19} /></span>
              <h1 className="min-w-0 break-words font-syne" style={{ fontSize: "clamp(20px, 2.1vw, 27px)", fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Client Management</h1>
            </div>
            <p className="font-dm mt-1 sm:ml-11" style={{ fontSize: 13, color: "#64748B" }}>Manage existing client access.</p>
          </div>
        </div>
      </header>
      <section className="mx-auto flex max-w-[1600px] flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-5 md:flex-row md:items-center">
            <div role="tablist" aria-label="Client management sections" className="flex gap-1 rounded-xl bg-slate-100 p-1">
              <button type="button" role="tab" aria-selected={tab==='directory'} onClick={()=>setTab('directory')}
                className={`rounded-lg px-3 py-2.5 font-dm text-xs font-semibold transition-colors ${tab === "directory" ? "bg-white text-red-800 shadow-sm" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"}`}>Client directory{!real?` (${clients.length})`:""}</button>
              <button type="button" role="tab" aria-selected={tab==='requests'} onClick={()=>setTab('requests')} className={`rounded-lg px-3 py-2.5 font-dm text-xs font-semibold transition-colors ${tab === "requests" ? "bg-white text-red-800 shadow-sm" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"}`}>Registration Requests</button>
            </div>
            <div className={`${tab==='requests'?'hidden':'flex'} w-full items-center gap-2 md:max-w-xl`}>
              <label className="relative min-w-0 flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                  placeholder="Search company, client ID, or email..."
                  aria-label="Search clients" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 font-dm text-sm outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-50" />
              </label>
              <Popover open={filterOpen} onOpenChange={(open) => {
                if (open) {
                  setDraftStatus(status);
                  setDraftSort(sort);
                }
                setFilterOpen(open);
              }}>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Open filters" aria-expanded={filterOpen}
                    className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 font-dm text-sm font-semibold transition-colors ${status !== "all" || sort !== "name-asc" ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
                    <SlidersHorizontal size={16} /> <span>Filter</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={8} className="w-80 rounded-xl border-slate-200 bg-white p-4 shadow-xl">
                  <div className="space-y-4">
                    <label className="block font-dm text-xs font-semibold text-slate-600">Account Status
                      <select aria-label="Filter by account status" value={draftStatus}
                        onChange={(event) => setDraftStatus(event.target.value as typeof draftStatus)}
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm font-normal text-slate-700">
                        <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Deactivated</option>
                      </select>
                    </label>
                    <label className="block font-dm text-xs font-semibold text-slate-600">Sort By
                      <select aria-label="Sort clients by" value={draftSort}
                        onChange={(event) => setDraftSort(event.target.value as ClientSort)}
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-dm text-sm font-normal text-slate-700">
                        <option value="name-asc">Client/Company Name A–Z</option>
                        <option value="name-desc">Client/Company Name Z–A</option>
                        <option value="id-asc">Client ID A–Z</option>
                        <option value="id-desc">Client ID Z–A</option>
                      </select>
                    </label>
                    <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                      <button type="button" onClick={resetClientFilters} className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold text-slate-600 hover:bg-slate-50">Reset</button>
                      <button type="button" onClick={applyClientFilters} className="rounded-lg bg-red-700 px-3 py-2 font-dm text-xs font-bold text-white hover:bg-red-800">Apply Filters</button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {tab==='requests'?<RegistrationRequests />:<>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5">
              <div><h2 className="font-syne text-lg font-bold text-slate-900">Client directory</h2><p className="font-dm text-xs text-slate-500">{real&&!remote.data?"Records unavailable":total} client account{filteredClients.length === 1 ? "" : "s"}</p></div>
            </div>
          {real&&(remote.loading||remote.error)&&<div className="px-4 py-3 sm:px-5"><AdminFeedback loading={remote.loading} error={remote.error} retry={remote.refresh} /></div>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px]">
                <thead className="bg-slate-50/80"><tr>
                  {["Client ID", "Client / Company", "Contact Person", "Email Address", "Contact Number", "Account Status", "Registered", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 text-left font-dm text-[11px] font-bold uppercase tracking-wider text-slate-500">{heading}</th>)}
                </tr></thead>
                <tbody>
                  {visibleRows.map((client) => (
                    <tr key={client.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 font-dm text-xs text-slate-600">{client.id}</td>
                      <td className="px-4 py-3.5 font-dm text-sm font-semibold text-slate-800">{client.name}</td>
                      <td className="px-4 py-3.5 font-dm text-xs text-slate-600">{client.contactPerson || "—"}</td>
                      <td className="px-4 py-3.5 font-dm text-xs text-slate-600">{client.email}</td>
                      <td className="px-4 py-3.5 font-dm text-xs text-slate-600">{client.phone || "—"}</td>
                      <td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 font-dm text-[11px] font-semibold ${statusClass(client.active)}`}>{real&&!client.accountId?"No portal account":client.active ? "Active" : "Deactivated"}</span></td>
                      <td className="px-4 py-3.5 font-dm text-xs text-slate-500">{client.joined}</td>
                      <td className="px-4 py-3.5"><div className="flex gap-1.5">
                        <button type="button" disabled={saving||(real&&(remote.loading||!!remote.error))} onClick={() => void openDetails(client)} aria-label={`View ${client.name}`} title="View details" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Eye size={14} /></button>
                        <button type="button" disabled={saving||(real&&(!client.accountId||remote.loading||!!remote.error))} onClick={() => beginEdit(client)} aria-label={`Edit ${client.name}`} title="Edit client details" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil size={14} /></button>
                        <button type="button" disabled={saving||(real&&(!client.accountId||remote.loading||!!remote.error))} onClick={() => void toggleClient(client)} aria-label={`${client.active ? "Deactivate" : "Activate"} ${client.name}`} title={`${client.active ? "Deactivate" : "Activate"} account`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700"><Power size={14} /></button>
                      </div></td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 && (!real||(!remote.loading&&!remote.error)) && <tr><td colSpan={8} className="px-5 py-14 text-center font-dm text-sm text-slate-500">{hasDirectoryCriteria ? "No clients match the current search and filters." : "No client accounts yet. Approved client registrations will appear here."}</td></tr>}
                </tbody>
              </table>
            </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p aria-live="polite" className="font-dm text-xs text-slate-500">{real&&!remote.data?"Client records have not loaded.":total === 0 ? "Showing 0 results" : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, total)} of ${total}`}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage(Math.max(1,currentPage-1))} disabled={currentPage <= 1||saving||(real&&remote.loading)} className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold disabled:opacity-50">Previous</button>
              <span className="min-w-20 text-center font-dm text-xs text-slate-500">Page {currentPage} of {pageCount}</span>
              <button type="button" onClick={() => setPage(Math.min(pageCount,currentPage+1))} disabled={currentPage >= pageCount||saving||(real&&remote.loading)} className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold disabled:opacity-50">Next</button>
            </div>
          </div>
          </>}
        </section>
      </section>

      {selected && <AdminDialog title="Client details" busy={saving} onClose={()=>setSelected(null)} headerActions={<Tooltip><TooltipTrigger asChild><button type="button" disabled={saving||(real&&!selected.accountId)} onClick={() => beginEdit(selected)} aria-label="Edit client details" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 hover:bg-blue-50 hover:text-blue-700"><Pencil size={15} aria-hidden="true" /></button></TooltipTrigger><TooltipContent side="top">Edit client details</TooltipContent></Tooltip>}>
          <p className="-mt-1 font-dm text-base font-medium leading-6 text-slate-700">{selected.name}</p>
          <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {[["Client ID", selected.id], ["Contact person", selected.contactPerson || "—"], ["Email address", selected.email], ["Username", selected.username], ["Contact number", selected.phone || "—"], ["Account status", real&&!selected.accountId?"No portal account":selected.active ? "Active" : "Deactivated"], ["Registration date", selected.joined]].map(([label, value]) => <div key={label}><dt className="font-dm text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-dm text-sm text-slate-800">{value}</dd></div>)}
          </dl>
          {!real&&<div className="mt-6 flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => { setResetting(selected); setNewPassword(""); }} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 font-dm text-sm font-semibold text-amber-800">Reset password</button></div>}
      </AdminDialog>}

      {resetting && !real && <AdminDialog title="Set a new client password" busy={saving} onClose={()=>setResetting(null)}><form onSubmit={resetClientPassword}>
        <p className="font-dm text-sm text-slate-500">For {resetting.name}. Only a salted password hash will be stored.</p>
        <label className="mt-5 block font-dm text-xs font-semibold text-slate-600">New password<input required minLength={8} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-red-300" /></label>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setResetting(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 font-dm text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving} className="rounded-lg bg-red-700 px-4 py-2.5 font-dm text-sm font-bold text-white disabled:opacity-60">{saving ? "Saving..." : "Update password"}</button></div>
      </form></AdminDialog>}

      {editing && <AdminDialog title="Edit client details" busy={saving} onClose={()=>setEditing(null)}><form onSubmit={saveClientDetails} aria-describedby={formError?"client-form-error":undefined}>
          <div className="border-b border-slate-200 pb-4"><p className="font-dm text-xs font-bold uppercase tracking-widest text-red-700">Client profile</p></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {([
              ["Company name", "name"],
              ["Contact person", "contactPerson"],
              ["Email address", "email"],
              ["Username", "username"],
              ["Contact number", "phone"],
            ] as const).map(([label, field]) => <label key={field} className="font-dm text-xs font-semibold text-slate-600">{label}<input aria-invalid={Boolean(fieldErrors[field==='name'?'companyName':field])} aria-describedby={fieldErrors[field==='name'?'companyName':field]?`client-error-${field}`:undefined} type={field === "email" ? "email" : "text"} required={field !== "contactPerson" && field !== "phone"} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-red-300" />{fieldErrors[field==='name'?'companyName':field]&&<span id={`client-error-${field}`} className="mt-1 block text-red-700">{fieldErrors[field==='name'?'companyName':field]}</span>}</label>)}
          </div>
          {formError&&<div id="client-form-error" role="alert" className="mt-3 text-sm text-red-700">{formError}{blocked&&<button type="button" className="mt-2 block rounded border px-3 py-2" onClick={async()=>{try{beginEdit(accountFromRow(await api<DirectoryRow>(`/api/admin/clients/${editing.id}`),'client') as ClientAccount);}catch(cause){setFormError((cause as Error).message);}}}>Reload current client</button>}</div>}
          <p className="mt-4 font-dm text-xs text-slate-500">Commercial terms and transaction history are not editable here.</p>
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-200 py-3"><button disabled={saving||blocked} type="submit" className="rounded-lg bg-red-700 px-4 py-2.5 font-dm text-sm font-bold text-white">{saving?"Saving...":"Save changes"}</button></div>
        </form></AdminDialog>}
    </main>
  );
}
