import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications, deptStyle } from "../store/notifications";
import { useSession } from "../store/session";
import type { Role } from "./Login";

interface Props {
  role?: Role;
  clientName?: string;
  onNavigate?: (id: string) => void;
}

export function NotificationBell({ role: roleProp, clientName, onNavigate }: Props) {
  const session = useSession();
  const role = roleProp ?? session.role;
  const navigate = onNavigate ?? session.navigate;
  const { unreadFor, markRead, markAllRead } = useNotifications();
  const notificationClient = role === "client" ? clientName ?? session.name : undefined;
  const items = unreadFor(role, notificationClient);
  const unreadCount = items.filter((n) => !n.read).length;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleClick = (id: string, link?: string) => {
    markRead(id);
    if (link) navigate?.(link);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`Notifications (${unreadCount} unread)`}
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50"
      >
        <Bell size={16} aria-hidden style={{ color: "#475569" }} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-white font-syne"
            style={{ backgroundColor: "#C8102E", fontSize: 10, fontWeight: 800 }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 z-50 w-[400px] bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col"
          style={{ boxShadow: "0 16px 48px rgba(15,23,42,0.18)", maxHeight: 540 }}
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#F4F6F9" }}>
            <div className="flex items-center gap-2">
              <Bell size={14} style={{ color: "#1A2B4A" }} />
              <span className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", letterSpacing: 0.4 }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#C8102E", color: "white" }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead(role, notificationClient)}
                className="font-dm flex items-center gap-1 hover:underline"
                style={{ fontSize: 11, color: "#1A2B4A", fontWeight: 600 }}
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto">
            {items.length === 0 ? (
              <div className="px-5 py-8 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>
                No notifications for your role yet.
              </div>
            ) : (
              items.map((n) => {
                const d = deptStyle[n.dept];
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n.id, n.link)}
                    className="w-full px-5 py-3 flex flex-col gap-1 text-left hover:bg-slate-50 border-b border-slate-100 transition-colors"
                    style={{ backgroundColor: n.read ? "white" : "#FEFCE8" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 800, backgroundColor: d.bg, color: d.color, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        {d.label}
                      </span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#C8102E" }} />}
                      <span className="ml-auto font-dm" style={{ fontSize: 10, color: "#94A3B8" }}>{n.time}</span>
                    </div>
                    <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{n.title}</div>
                    <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{n.body}</div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#F8FAFC" }}>
            <span className="font-dm" style={{ fontSize: 10, color: "#94A3B8" }}>
              Filtered for your role
            </span>
            <button
              onClick={() => { navigate?.("notifications"); setOpen(false); }}
              className="font-dm hover:underline"
              style={{ fontSize: 11, color: "#C8102E", fontWeight: 700 }}
            >
              View all →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
