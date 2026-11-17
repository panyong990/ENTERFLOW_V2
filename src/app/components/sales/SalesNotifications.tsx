import { useState } from "react";
import { Bell, CheckCheck, Search, Trash2, X } from "lucide-react";
import { useSession } from "../../store/session";
import { pendingIntegration } from "./drafts";
import { useSalesWorkspaceData, type SalesNotificationResult } from "./useSalesWorkspaceData";

export function SalesNotificationBell() {
  const [open, setOpen] = useState(false);
  return <div className="relative"><button aria-label="Sales notifications" onClick={() => setOpen(!open)} className="rounded-full border p-2 text-slate-600"><Bell size={18} /></button>{open && <div className="fixed right-4 top-24 z-40 max-h-[75vh] w-[min(400px,calc(100vw-32px))] overflow-auto rounded-xl border bg-white shadow-xl"><button aria-label="Close notification panel" onClick={() => setOpen(false)} className="float-right p-3"><X size={16} /></button><SalesNotifications compact /></div>}</div>;
}

export function SalesNotifications({ compact = false }: { compact?: boolean }) {
  const [q, setQ] = useState(""), [status, setStatus] = useState("all"), [category, setCategory] = useState("all"), [page, setPage] = useState(1);
  const session = useSession();
  const remote = useSalesWorkspaceData<SalesNotificationResult>(`/api/sales/notifications?${new URLSearchParams({ q, status, page: String(page), pageSize: "25", sort: "created-desc" })}`);
  const rows = remote.data?.items.filter(item => category === "all" || item.category === category) ?? [];
  return <main className={`${compact ? "p-4" : "h-full overflow-auto bg-[#F4F6F9]"}`}>
    <header className={`${compact ? "mb-4" : "border-b bg-white px-8 py-5"}`}><h1 className="font-syne text-2xl font-extrabold text-slate-900">Notifications</h1><p className="mt-1 text-xs text-slate-500">Sales updates · Read state confirmed by the server</p></header>
    <section className={compact ? "" : "p-8"}>
      <div className="mb-4 flex flex-wrap items-center gap-2"><label className="relative flex-1"><Search size={14} className="absolute left-3 top-3 text-slate-400" /><input maxLength={254} aria-label="Search notifications" placeholder="Search notifications..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} className="w-full rounded-lg border bg-white py-2 pl-9 text-sm" /></label><select aria-label="Notification read filter" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="rounded border p-2 text-xs"><option value="all">All notifications</option><option value="unread">Unread</option><option value="read">Read</option></select><select aria-label="Notification category" value={category} onChange={e => setCategory(e.target.value)} className="rounded border p-2 text-xs">{["all", "sales", "production", "warehouse", "logistics", "payments", "system"].map(value => <option key={value} value={value}>{value}</option>)}</select></div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs"><button onClick={remote.refresh}>Refresh notifications</button><button onClick={() => pendingIntegration("Mark all notifications read")} className="flex items-center gap-1"><CheckCheck size={13} />Mark all read</button><button onClick={() => pendingIntegration("Dismiss notifications")} className="flex items-center gap-1"><Trash2 size={13} />Clear read</button></div>
      <p className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Mark-read and dismissal integration is pending. Opening a notification preserves its server read state.</p>
      {remote.loading && <p role="status">Loading Sales notifications…</p>}{!remote.loading && remote.error && <p role="alert" className="text-sm text-red-700">{remote.error} <button onClick={remote.refresh}>Retry</button></p>}
      {!remote.loading && !remote.error && <div className="space-y-3">{rows.length ? rows.map(item => <article key={item.id} className={`rounded-xl border bg-white p-4 ${item.isRead ? "border-slate-200" : "border-blue-200"}`}><div className="flex items-start justify-between gap-3"><h2 className="text-sm font-bold text-slate-900">{item.title}</h2><span className="text-[10px] font-bold text-blue-700">{item.isRead ? "READ" : "UNREAD"}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.message}</p><p className="mt-2 text-[11px] text-slate-400">{item.category} · {item.createdAt}</p><div className="mt-3 flex gap-4 text-xs">{item.orderId && <button onClick={() => session.navigate?.("sales", String(item.orderId))} className="font-semibold text-red-700">View related order</button>}<button onClick={() => pendingIntegration("Mark notification read")}>Mark read</button></div></article>) : <p className="rounded-lg border bg-white p-8 text-center text-sm text-slate-500">No notifications match the current filters.</p>}</div>}
      <div className="mt-4 flex items-center justify-between text-xs"><button disabled={page <= 1 || remote.loading} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40">Previous</button><span>Page {remote.data?.page ?? page} · {remote.data?.total ?? "Unverified"} matching records</span><button disabled={!remote.data || page * 25 >= remote.data.total || remote.loading} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40">Next</button></div>
    </section>
  </main>;
}
