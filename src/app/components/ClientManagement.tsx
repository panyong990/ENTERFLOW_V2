import { useMemo, useState, type FormEvent } from "react";
import { Building2, Eye, Pencil, Search, SlidersHorizontal, X } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  getAccounts,
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

export function ClientManagement() {
  const { role } = useSession();
  if (role !== "admin") return <Unauthorized />;
  return <ClientManagementPage />;
}

function ClientManagementPage() {
  const [accounts, setAccounts] = useState<Account[]>(getAccounts);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<ClientSort>("name-asc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftSort, setDraftSort] = useState<ClientSort>(sort);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ClientAccount | null>(null);
  const [editing, setEditing] = useState<ClientAccount | null>(null);
  const [draft, setDraft] = useState({ name: "", contactPerson: "", email: "", username: "", phone: "" });

  const clients = useMemo(() => accounts.filter(isClientAccount), [accounts]);
  const filteredClients = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const filtered = clients.filter((client) => {
      if (status === "active" && !client.active) return false;
      if (status === "inactive" && client.active) return false;
      return !term || [client.name, client.id, client.email].some((value) => value.toLocaleLowerCase().includes(term));
    });
    const direction = sort.endsWith("desc") ? -1 : 1;
    const field = sort.startsWith("name") ? "name" : "id";
    return filtered.sort((a, b) => direction * a[field].localeCompare(b[field], undefined, { numeric: true, sensitivity: "base" }));
  }, [clients, query, sort, status]);
  const pageCount = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filteredClients.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateAccounts = (next: Account[]) => {
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
  const saveClientDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
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
    try {
      updateAccounts(accounts.map((account) => account.id === editing.id
        ? { ...account, name, email, username, phone: draft.phone.trim() || "—", contactPerson: draft.contactPerson.trim() }
        : account));
      setSelected(null);
      setEditing(null);
      toast.success("Client details updated.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Unable to save client details.");
    }
  };
  const openDetails = (client: ClientAccount) => {
    setSelected(client);
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
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 px-4 py-4 sm:px-6 sm:py-5 xl:flex-row xl:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-syne text-lg font-bold text-slate-900">Client Directory</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-dm text-[11px] font-semibold text-slate-600">{clients.length} total</span>
              </div>
              <p className="mt-1 font-dm text-xs text-slate-500">{filteredClients.length} client account{filteredClients.length === 1 ? "" : "s"} shown</p>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center xl:max-w-xl">
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px]">
                <thead className="bg-slate-50/80"><tr>
                  {["Client / Company", "Client ID", "Contact Person", "Email Address", "Contact Number", "Account Status", "Registered", "Actions"].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3 text-left font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500">{heading}</th>)}
                </tr></thead>
                <tbody>
                  {visibleRows.map((client) => (
                    <tr key={client.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 font-dm text-sm font-semibold text-slate-800">{client.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-dm text-xs text-slate-600">{client.id}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-dm text-xs text-slate-600">{client.contactPerson || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-dm text-xs text-slate-600">{client.email}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-dm text-xs text-slate-600">{client.phone || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3"><span className={`rounded-full px-2.5 py-1 font-dm text-[11px] font-semibold ${statusClass(client.active)}`}>{client.active ? "Active" : "Deactivated"}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 font-dm text-xs text-slate-500">{client.joined}</td>
                      <td className="whitespace-nowrap px-4 py-3"><div className="flex items-center gap-2">
                        <button type="button" onClick={() => openDetails(client)} aria-label={`View ${client.name}`} title="View details" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#1A2B4A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"><Eye size={15} /></button>
                        <button type="button" onClick={() => beginEdit(client)} aria-label={`Edit ${client.name}`} title="Edit client details" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#1A2B4A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"><Pencil size={15} /></button>
                      </div></td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center font-dm text-sm text-slate-500">{clients.length ? "No clients match the current search and filters." : "No client accounts are available."}</td></tr>}
                </tbody>
              </table>
            </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p aria-live="polite" className="font-dm text-xs text-slate-500">{filteredClients.length === 0 ? "Showing 0 results" : `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredClients.length)} of ${filteredClients.length}`}</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1} className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold disabled:opacity-50">Previous</button>
              <span className="min-w-20 text-center font-dm text-xs text-slate-500">Page {currentPage} of {pageCount}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount} className="rounded-lg border border-slate-200 px-3 py-2 font-dm text-xs font-semibold disabled:opacity-50">Next</button>
            </div>
          </div>
        </section>
      </section>

      {selected && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <section role="dialog" aria-modal="true" aria-label={`${selected.name} client details`} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between"><div><p className="font-dm text-xs font-bold uppercase tracking-widest text-red-700">Client account</p><h2 className="mt-1 font-syne text-xl font-bold text-slate-900">{selected.name}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {[["Client ID", selected.id], ["Contact person", selected.contactPerson || "—"], ["Email address", selected.email], ["Username", selected.username], ["Contact number", selected.phone || "—"], ["Account status", selected.active ? "Active" : "Deactivated"], ["Registration date", selected.joined]].map(([label, value]) => <div key={label}><dt className="font-dm text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-dm text-sm text-slate-800">{value}</dd></div>)}
          </dl>
          <div className="mt-6 flex justify-end"><button type="button" onClick={() => beginEdit(selected)} className="rounded-lg border border-slate-200 px-4 py-2.5 font-dm text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">Edit details</button></div>
        </section>
      </div>}

      {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
        <form onSubmit={saveClientDetails} role="dialog" aria-modal="true" aria-label="Edit client details" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between"><div><p className="font-dm text-xs font-bold uppercase tracking-widest text-red-700">Client profile</p><h2 className="mt-1 font-syne text-xl font-bold text-slate-900">Edit client details</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="Close editor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {([
              ["Company name", "name"],
              ["Contact person", "contactPerson"],
              ["Email address", "email"],
              ["Username", "username"],
              ["Contact number", "phone"],
            ] as const).map(([label, field]) => <label key={field} className="font-dm text-xs font-semibold text-slate-600">{label}<input type={field === "email" ? "email" : "text"} required={field !== "contactPerson" && field !== "phone"} value={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-red-300" /></label>)}
          </div>
          <p className="mt-4 font-dm text-xs text-slate-500">Commercial terms and transaction history are not editable here.</p>
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 font-dm text-sm font-semibold text-slate-600">Cancel</button><button type="submit" className="rounded-lg bg-red-700 px-4 py-2.5 font-dm text-sm font-bold text-white">Save changes</button></div>
        </form>
      </div>}
    </main>
  );
}
