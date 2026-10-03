import { createContext, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Role } from "../components/Login";

export type Department = "sales" | "production" | "logistics" | "payments" | "system";

export interface Notification {
  id: string;
  dept: Department;
  title: string;
  body: string;
  time: string;        /* "2 min ago" or ISO */
  link?: string;       /* module id to navigate to */
  recipients: Role[];  /* which roles see this */
  clientName?: string;
  read: boolean;
}

export const deptStyle: Record<Department, { color: string; bg: string; label: string }> = {
  sales:      { color: "#C8102E", bg: "#FEE2E2", label: "Sales" },
  production: { color: "#1A2B4A", bg: "#DBEAFE", label: "Production" },
  logistics:  { color: "#C9A84C", bg: "#FEF3C7", label: "Logistics" },
  payments:   { color: "#16A34A", bg: "#DCFCE7", label: "Payments" },
  system:     { color: "#475569", bg: "#E2E8F0", label: "System" },
};

const seed: Notification[] = [
  {
    id: "n1", dept: "sales", title: "New inquiry from Monaco",
    body: "INQ-007 · 50 pcs Air Oil Separator · marked URGENT",
    time: "5 min ago", link: "sales", read: false,
    recipients: ["owner", "operations", "sales"],
  },
  {
    id: "n2", dept: "production", title: "JO-2026-001 → Quality Inspection",
    body: "B.E. Aerospace · Air Filter · Stage 9 of 10",
    time: "15 min ago", link: "production", read: false,
    recipients: ["owner", "operations", "production"],
  },
  {
    id: "n3", dept: "logistics", title: "Delivery dispatched: PO-2026-9531",
    body: "Maynilad · Pleated Filter ZS20 · Lalamove",
    time: "1 hr ago", link: "logistics", read: true,
    recipients: ["owner", "operations", "logistics", "accounting"],
  },
  {
    id: "n4", dept: "payments", title: "Receipt uploaded by client",
    body: "B.E. Aerospace · ₱23,400 · BDO ref BDO-2026-04100",
    time: "3 hr ago", link: "accounting", read: false,
    recipients: ["owner", "operations", "accounting"],
  },
  {
    id: "n5", dept: "system", title: "Filter Media stock low",
    body: "Only 5 rolls left — reorder triggered",
    time: "Yesterday", link: "inventory", read: true,
    recipients: ["owner", "operations", "warehouse"],
  },
];

interface Ctx {
  notifications: Notification[];
  unreadFor: (role: Role, clientName?: string) => Notification[];
  push: (n: Omit<Notification, "id" | "time" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: (role: Role, clientName?: string) => void;
  remove: (id: string) => void;
  removeAllRead: (role: Role) => void;
}

const NotifContext = createContext<Ctx | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Notification[]>(seed);

  const unreadFor: Ctx["unreadFor"] = (role, clientName) =>
    list.filter((n) => n.recipients.includes(role) && (role !== "client" || !n.clientName || n.clientName === clientName));

  const push: Ctx["push"] = (n) => {
    const id = `n-${Date.now()}`;
    setList((prev) => [
      { ...n, id, time: "just now", read: false },
      ...prev,
    ]);
    /* Mock email dispatch confirmation — Email gateway not implemented */
    const channels = pickChannels(n.dept);
    if (channels.length > 0) {
      setTimeout(() => {
        toast(
          `📨 ${channels.join(" + ")} dispatched`,
          {
            description: `${n.title} → ${n.recipients.join(", ")}`,
            duration: 2200,
          }
        );
      }, 250);
    }
  };

  /* Default per-department channel routing — overridden by user preferences in production */
  function pickChannels(dept: Department): string[] {
    const map: Record<Department, string[]> = {
      sales: ["Email"],
      production: ["Email"],
      logistics: ["Email"],
      payments: ["Email"],
      system: ["Email"],
    };
    return map[dept];
  }

  const markRead: Ctx["markRead"] = (id) => {
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead: Ctx["markAllRead"] = (role, clientName) => {
    setList((prev) => prev.map((n) => (
      n.recipients.includes(role) && (role !== "client" || !n.clientName || n.clientName === clientName)
        ? { ...n, read: true }
        : n
    )));
  };

  const remove: Ctx["remove"] = (id) => {
    setList((prev) => prev.filter((n) => n.id !== id));
  };

  const removeAllRead: Ctx["removeAllRead"] = (role) => {
    setList((prev) => prev.filter((n) => !(n.recipients.includes(role) && n.read)));
  };

  return (
    <NotifContext.Provider value={{ notifications: list, unreadFor, push, markRead, markAllRead, remove, removeAllRead }}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotifications() {
  const c = useContext(NotifContext);
  if (!c) throw new Error("useNotifications must be inside NotificationsProvider");
  return c;
}
