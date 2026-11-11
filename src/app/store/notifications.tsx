import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Role } from "../components/Login";

export type Department = "sales" | "production" | "warehouse" | "logistics" | "payments" | "system";

export interface Notification {
  id: string;
  dept: Department;
  title: string;
  body: string;
  time: string;        /* "2 min ago" or ISO */
  link?: string;       /* module id to navigate to */
  recipients: Role[];  /* which roles see this */
  clientName?: string;
  resourceType?: "official-receipt";
  resourceId?: string;
  clientLink?: string;
  readBy?: string[];
  hiddenFor?: string[];
  read: boolean;
}

export const deptStyle: Record<Department, { color: string; bg: string; label: string }> = {
  sales:      { color: "#C8102E", bg: "#FEE2E2", label: "Sales" },
  production: { color: "#1A2B4A", bg: "#DBEAFE", label: "Production" },
  warehouse:  { color: "#475569", bg: "#E2E8F0", label: "Warehouse" },
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
    body: "B.E. Aerospace · Air Filter · Stage 9 of 9",
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
  isReadFor: (notification: Notification, role: Role, clientName?: string) => boolean;
  markRead: (id: string, role: Role, clientName?: string) => void;
  markAllRead: (role: Role, clientName?: string) => void;
  remove: (id: string, role: Role, clientName?: string) => void;
  removeAllRead: (role: Role, clientName?: string) => void;
}

const NotifContext = createContext<Ctx | null>(null);

const NOTIFICATIONS_STORAGE_KEY = "enterflow.notifications.v1";

function loadPersistedNotifications(): Notification[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return seed;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seed;
    if (!parsed.every((notification) => (
      notification && typeof notification === "object"
      && typeof (notification as Notification).id === "string"
      && typeof (notification as Notification).title === "string"
      && typeof (notification as Notification).body === "string"
      && Array.isArray((notification as Notification).recipients)
      && typeof (notification as Notification).read === "boolean"
    ))) return seed;
    return parsed as Notification[];
  } catch {
    return seed;
  }
}

function recipientKey(role: Role, clientName?: string): string | undefined {
  if (role !== "client") return `role:${role}`;
  const normalizedClient = clientName?.trim().toLocaleLowerCase();
  return normalizedClient ? `client:${normalizedClient}` : undefined;
}

function isRecipient(notification: Notification, role: Role, clientName?: string): boolean {
  if (!notification.recipients.includes(role)) return false;
  if (role !== "client") return true;
  const normalizedClient = clientName?.trim().toLocaleLowerCase();
  const notificationClient = typeof notification.clientName === "string"
    ? notification.clientName.trim().toLocaleLowerCase()
    : "";
  return Boolean(normalizedClient && notificationClient === normalizedClient);
}

export function notificationDestination(notification: Notification, role: Role): string | undefined {
  return role === "client" ? notification.clientLink ?? notification.link : notification.link;
}

export function notificationStyle(dept: string) {
  return deptStyle[dept as Department] ?? deptStyle.system;
}

function hasScopeValue(values: string[] | undefined, key: string): boolean {
  return Array.isArray(values) && values.includes(key);
}

function addScopeValue(values: string[] | undefined, key: string): string[] {
  return [...new Set([...(Array.isArray(values) ? values : []), key])];
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Notification[]>(loadPersistedNotifications);
  const nextNotificationId = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
    } catch (error) {
      console.error("[EnterFlow] Could not persist notifications to localStorage.", error);
    }
  }, [list]);

  const unreadFor: Ctx["unreadFor"] = (role, clientName) => {
    const key = recipientKey(role, clientName);
    if (!key) return [];
    return list.filter((notification) => (
      isRecipient(notification, role, clientName)
      && !hasScopeValue(notification.hiddenFor, key)
    ));
  };

  const isReadFor: Ctx["isReadFor"] = (notification, role, clientName) => {
    const key = recipientKey(role, clientName);
    return notification.read || Boolean(key && hasScopeValue(notification.readBy, key));
  };

  const push: Ctx["push"] = (n) => {
    if (n.recipients.includes("client") && !n.clientName?.trim()) {
      throw new Error("Client notifications must include the intended client name.");
    }
    const id = `n-${Date.now()}-${nextNotificationId.current++}`;
    setList((prev) => [
      { ...n, id, time: "just now", read: false },
      ...prev,
    ]);
    /* Mock email dispatch confirmation — Email gateway not implemented */
    const channels = pickChannels(n.dept);
    if (channels.length > 0) {
      setTimeout(() => {
        toast(
          `📨 ${channels.join(" + ")} notification simulated`,
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
      warehouse: ["Email"],
      logistics: ["Email"],
      payments: ["Email"],
      system: ["Email"],
    };
    return map[dept];
  }

  const markRead: Ctx["markRead"] = (id, role, clientName) => {
    const key = recipientKey(role, clientName);
    if (!key) return;
    setList((prev) => prev.map((notification) => (
      notification.id === id
      && isRecipient(notification, role, clientName)
      && !isReadFor(notification, role, clientName)
        ? { ...notification, readBy: addScopeValue(notification.readBy, key) }
        : notification
    )));
  };

  const markAllRead: Ctx["markAllRead"] = (role, clientName) => {
    const key = recipientKey(role, clientName);
    if (!key) return;
    setList((prev) => prev.map((notification) => (
      isRecipient(notification, role, clientName) && !isReadFor(notification, role, clientName)
        ? { ...notification, readBy: addScopeValue(notification.readBy, key) }
        : notification
    )));
  };

  const remove: Ctx["remove"] = (id, role, clientName) => {
    const key = recipientKey(role, clientName);
    if (!key) return;
    setList((prev) => prev.map((notification) => (
      notification.id === id && isRecipient(notification, role, clientName)
        ? { ...notification, hiddenFor: addScopeValue(notification.hiddenFor, key) }
        : notification
    )));
  };

  const removeAllRead: Ctx["removeAllRead"] = (role, clientName) => {
    const key = recipientKey(role, clientName);
    if (!key) return;
    setList((prev) => prev.map((notification) => (
      isRecipient(notification, role, clientName) && isReadFor(notification, role, clientName)
        ? { ...notification, hiddenFor: addScopeValue(notification.hiddenFor, key) }
        : notification
    )));
  };

  return (
    <NotifContext.Provider value={{ notifications: list, unreadFor, push, isReadFor, markRead, markAllRead, remove, removeAllRead }}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotifications() {
  const c = useContext(NotifContext);
  if (!c) throw new Error("useNotifications must be inside NotificationsProvider");
  return c;
}
