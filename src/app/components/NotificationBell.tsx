import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck } from "lucide-react";
import {
  useNotifications,
  notificationDestination,
  notificationStyle,
  type Department,
} from "../store/notifications";
import { useSession } from "../store/session";
import type { Role } from "./Login";
import { useOrders } from "../store/orders";
import { findReceiptForNotification, isOfficialReceiptNotification } from "./officialReceiptNotifications";
import { OfficialReceiptPreviewModal } from "./OfficialReceiptPreviewModal";
import { canNavigateToNotification } from "./notificationRoutes";
import { toast } from "sonner";

interface Props {
  role?: Role;
  clientName?: string;
  onNavigate?: (id: string, inquiryId?: string) => void;
}

export function NotificationBell({ role: roleProp, clientName, onNavigate }: Props) {
  const session = useSession();
  const role = roleProp ?? session.role;
  const navigate = onNavigate ?? session.navigate;
  const { unreadFor, isReadFor, markRead, markAllRead } = useNotifications();
  const { inquiries, completedJOs } = useOrders();
  const notificationClient = role === "client" ? clientName ?? session.name : undefined;
  const items = unreadFor(role, notificationClient);
  const unreadCount = items.filter((notification) => !isReadFor(notification, role, notificationClient)).length;
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | Department>("all");
  const availableCategories = [...new Set(items.map((notification) => notification.dept))]
    .sort((left, right) => notificationStyle(left).label.localeCompare(notificationStyle(right).label));
  const categoryOptionsKey = availableCategories.join("|");
  const visibleItems = items.filter((notification) => {
    const read = isReadFor(notification, role, notificationClient);
    const matchesCategory = categoryFilter === "all" || notification.dept === categoryFilter;
    const matchesReadStatus = readFilter === "all"
      || (readFilter === "unread" ? !read : read);
    return matchesCategory && matchesReadStatus;
  });
  const [open, setOpen] = useState(false);
  const [dropdownLeft, setDropdownLeft] = useState(0);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(540);
  const [receiptToView, setReceiptToView] = useState<NonNullable<ReturnType<typeof findReceiptForNotification>> | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReadFilter("all");
    setCategoryFilter("all");
  }, [role, notificationClient]);

  useEffect(() => {
    if (categoryFilter !== "all" && !availableCategories.includes(categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categoryFilter, categoryOptionsKey]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function updateDropdownPosition() {
      if (!ref.current) return;
      const bounds = ref.current.getBoundingClientRect();
      const popupWidth = Math.min(400, Math.max(0, window.innerWidth - 32));
      const popupLeft = Math.min(
        Math.max(bounds.right - popupWidth, 16),
        window.innerWidth - 16 - popupWidth,
      );
      setDropdownLeft(popupLeft - bounds.left);
      setDropdownMaxHeight(Math.max(0, Math.min(540, window.innerHeight - bounds.top - 64)));
    }
    if (open) {
      updateDropdownPosition();
      document.addEventListener("mousedown", onClickOutside);
      window.addEventListener("resize", updateDropdownPosition);
      window.addEventListener("scroll", updateDropdownPosition, true);
    }
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [open]);

  const handleClick = (notification: (typeof items)[number]) => {
    const isReceipt = isOfficialReceiptNotification(notification);
    markRead(notification.id, role, notificationClient);
    if (isReceipt) {
      const receipt = findReceiptForNotification(notification, [...inquiries, ...completedJOs], notificationClient);
      if (receipt) setReceiptToView(receipt);
      else toast.error("Official Receipt could not be found. Please contact Accounting.");
      setOpen(false);
      return;
    }
    const destination = notificationDestination(notification, role);
    if (destination) {
      if (canNavigateToNotification(role, destination)) navigate?.(destination, notification.inquiryId);
      else toast.info("This notification has no destination available to your role.");
    }
    setOpen(false);
  };

  const openHistory = () => {
    if (canNavigateToNotification(role, "notifications")) navigate?.("notifications");
    else toast.info("Notification history is not available to your role.");
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
          className="absolute top-12 z-50 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col"
          style={{ boxShadow: "0 16px 48px rgba(15,23,42,0.18)", maxHeight: dropdownMaxHeight, width: "min(400px, calc(100vw - 2rem))", left: dropdownLeft }}
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

          <div className="grid grid-cols-2 gap-3 border-b border-slate-100 bg-white px-4 py-2.5">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="font-dm" style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>
                Read Status
              </span>
              <select
                aria-label="Filter notifications by read status"
                value={readFilter}
                onChange={(event) => setReadFilter(event.target.value as "all" | "unread" | "read")}
                className="h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 font-dm outline-none focus:border-slate-400"
                style={{ fontSize: 11, color: "#334155" }}
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="font-dm" style={{ fontSize: 9, fontWeight: 700, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>
                Category
              </span>
              <select
                aria-label="Filter notifications by category"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value as "all" | Department)}
                className="h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 font-dm outline-none focus:border-slate-400"
                style={{ fontSize: 11, color: "#334155" }}
              >
                <option value="all">All Categories</option>
                {availableCategories.map((dept) => (
                  <option key={dept} value={dept}>{notificationStyle(dept).label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* List */}
          <div className="min-h-0 flex-1 overflow-auto">
            {items.length === 0 ? (
              <div className="px-5 py-8 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>
                No notifications for your role yet.
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="px-5 py-8 text-center font-dm" style={{ fontSize: 12, color: "#94A3B8" }}>
                No notifications match these filters.
              </div>
            ) : (
              visibleItems.map((n) => {
                const d = notificationStyle(n.dept);
                const read = isReadFor(n, role, notificationClient);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className="w-full px-5 py-3 flex flex-col gap-1 text-left hover:bg-slate-50 border-b border-slate-100 transition-colors"
                    style={{ backgroundColor: read ? "white" : "#FEFCE8" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 9, fontWeight: 800, backgroundColor: d.bg, color: d.color, letterSpacing: 0.5, textTransform: "uppercase" }}>
                        {d.label}
                      </span>
                      {!read && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#C8102E" }} />}
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
              {role === "client" ? "Filtered for your account" : "Filtered for your role"}
            </span>
            {canNavigateToNotification(role, "notifications") && (
              <button
                onClick={openHistory}
                className="font-dm hover:underline"
                style={{ fontSize: 11, color: "#C8102E", fontWeight: 700 }}
              >
                View all →
              </button>
            )}
          </div>
        </div>
      )}
      {receiptToView && <OfficialReceiptPreviewModal receipt={receiptToView} onClose={() => setReceiptToView(null)} />}
    </div>
  );
}
