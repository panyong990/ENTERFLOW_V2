import { useSalesWorkspaceData, type SalesNotificationResult } from "./useSalesWorkspaceData";
import { pendingIntegration } from "./drafts";
import type { Notification } from "../../store/notifications";

export function useSalesNotificationStore(page: number) {
  const remote = useSalesWorkspaceData<SalesNotificationResult>(`/api/sales/notifications?status=all&sort=created-desc&page=${page}&pageSize=25`);
  const items = (remote.data?.items ?? []).map(item => ({
    id: String(item.id), dept: item.category, title: item.title, body: item.message,
    inquiryId: item.orderId == null ? undefined : String(item.orderId),
    link: item.orderId ? "sales" : undefined, time: item.createdAt, read: item.isRead,
    recipients: ["sales"],
  })) as unknown as Notification[];
  return { ...remote,
    unreadFor: (..._args: unknown[]) => items,
    isReadFor: (item: Notification, ..._args: unknown[]) => Boolean((item as Notification & { read: boolean }).read),
    markRead: () => pendingIntegration("Mark notification read"),
    markAllRead: () => pendingIntegration("Mark all notifications read"),
    remove: () => pendingIntegration("Dismiss notification"),
    removeAllRead: () => pendingIntegration("Dismiss read notifications"),
    push: () => pendingIntegration("Send notification"),
  };
}
