import { useState } from "react";
import { Bell, CheckCheck, Trash2, Search, Filter } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useNotifications, deptStyle, type Department } from "../store/notifications";
import { useSession } from "../store/session";
import { NotificationBell } from "./NotificationBell";

export function NotificationsCenter() {
  const session = useSession();
  const role = session.role;
  const { unreadFor, markRead, markAllRead, remove, removeAllRead } = useNotifications();
  const items = unreadFor(role);
  const [query, setQuery] = useState("");
  const [filterDept, setFilterDept] = useState<"all" | Department>("all");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");

  const visible = items.filter((n) => {
    const q = query.toLowerCase();
    const searchOk = !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
    const deptOk = filterDept === "all" || n.dept === filterDept;
    const readOk = readFilter === "all" || (readFilter === "unread" ? !n.read : n.read);
    return searchOk && deptOk && readOk;
  });

  const handleClick = (id: string, link?: string) => {
    markRead(id);
    if (link && session.navigate) session.navigate(link);
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <h1 className="font-syne flex items-center gap-3" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            <Bell size={26} style={{ color: "#C8102E" }} /> Notifications
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            All in-app notifications for your role · Filtered for {role}
          </p>
        </div>
        <NotificationBell />
      </header>

      <div className="px-8 py-8 flex flex-col gap-5">
        {/* Stats + actions */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/70 p-4">
            <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Total</div>
            <div className="font-syne mt-1" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{items.length}</div>
          </div>
          <div className="bg-white rounded-xl border-2 p-4" style={{ borderColor: "#C8102E" }}>
            <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", letterSpacing: 0.5, textTransform: "uppercase" }}>Unread</div>
            <div className="font-syne mt-1" style={{ fontSize: 28, fontWeight: 800, color: "#C8102E", lineHeight: 1 }}>{items.filter(n => !n.read).length}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/70 p-4">
            <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Read</div>
            <div className="font-syne mt-1" style={{ fontSize: 28, fontWeight: 800, color: "#16A34A", lineHeight: 1 }}>{items.filter(n => n.read).length}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200/70 p-4 flex flex-col gap-2 justify-center">
            <button
              onClick={() => { markAllRead(role); toast.success("All marked as read"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-dm hover:bg-slate-50 border border-slate-200"
              style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}
            >
              <CheckCheck size={12} /> Mark all read
            </button>
            <button
              onClick={() => { removeAllRead(role); toast.success("Read notifications cleared"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-dm hover:bg-red-50 border border-red-200"
              style={{ fontSize: 11, fontWeight: 600, color: "#C8102E" }}
            >
              <Trash2 size={12} /> Clear read
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200/70 p-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notifications..."
              className="font-dm w-full pl-9 pr-4 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
              style={{ fontSize: 13 }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} style={{ color: "#94A3B8" }} />
            <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Department:</span>
            {(["all", "sales", "production", "logistics", "payments", "system"] as const).map((d) => {
              const active = filterDept === d;
              const s = d === "all" ? null : deptStyle[d];
              return (
                <button
                  key={d}
                  onClick={() => setFilterDept(d)}
                  className="font-dm px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: active ? (s?.color ?? "#1A2B4A") : (s?.bg ?? "#F1F5F9"),
                    color: active ? "white" : (s?.color ?? "#64748B"),
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  {d === "all" ? "All" : s?.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>Status:</span>
            {(["all", "unread", "read"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setReadFilter(r)}
                className="font-dm px-2.5 py-1 rounded-full"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: readFilter === r ? "#1A2B4A" : "#F1F5F9",
                  color: readFilter === r ? "white" : "#64748B",
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          {visible.length === 0 ? (
            <div className="px-6 py-12 text-center font-dm" style={{ fontSize: 13, color: "#94A3B8" }}>
              <Bell size={32} style={{ color: "#CBD5E1", margin: "0 auto 8px" }} />
              No notifications match your filters.
            </div>
          ) : (
            visible.map((n) => {
              const d = deptStyle[n.dept];
              return (
                <div
                  key={n.id}
                  className="flex items-start gap-4 px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group"
                  style={{ backgroundColor: n.read ? "white" : "#FEFCE8" }}
                >
                  <button onClick={() => handleClick(n.id, n.link)} className="flex-1 text-left flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 800, backgroundColor: d.bg, color: d.color, letterSpacing: 0.5, textTransform: "uppercase" }}>{d.label}</span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#C8102E" }} />}
                      <span className="ml-auto font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>{n.time}</span>
                    </div>
                    <div className="font-dm" style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{n.title}</div>
                    <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{n.body}</div>
                    {n.link && (
                      <div className="font-dm mt-0.5" style={{ fontSize: 11, color: "#C8102E", fontWeight: 600 }}>Click to view in {n.link} →</div>
                    )}
                  </button>
                  <button
                    onClick={() => { remove(n.id); toast("Notification deleted"); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 rounded-md hover:bg-red-50 flex items-center justify-center"
                    style={{ color: "#94A3B8" }}
                    title="Delete notification"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="rounded-md px-4 py-3 font-dm" style={{ fontSize: 11, color: "#1E40AF", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
          ℹ️ Notifications are role-filtered. Email alerts via <strong>SendGrid</strong> · SMS via <strong>Semaphore (PH)</strong> — toggle channels per event in Settings.
        </div>
      </div>
    </div>
  );
}
