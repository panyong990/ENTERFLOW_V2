import type { Inquiry, OfficialReceipt } from "../store/orders";
import type { Notification } from "../store/notifications";

export function isOfficialReceiptNotification(notification: Notification): boolean {
  return notification.resourceType === "official-receipt"
    || /official receipt available/i.test(notification.title)
    || /official receipt/i.test(notification.body);
}

export function officialReceiptNumberFromNotification(notification: Notification): string | undefined {
  const match = notification.title.match(/official receipt available\s*:\s*(\S+)/i);
  return match?.[1]?.trim();
}

export function findReceiptForNotification(
  notification: Notification,
  inquiries: Inquiry[],
  clientName?: string,
): OfficialReceipt | undefined {
  if (!isOfficialReceiptNotification(notification)) return undefined;

  const accessibleInquiries = inquiries.filter((inquiry) => {
    if (!clientName) return true;
    return inquiry.clientName === clientName && notification.clientName === clientName;
  });
  const byResourceId = notification.resourceId
    ? accessibleInquiries.find((inquiry) => inquiry.id === notification.resourceId)
    : undefined;
  const orNumber = officialReceiptNumberFromNotification(notification);
  const byOrNumber = orNumber
    ? accessibleInquiries.find((inquiry) => inquiry.officialReceipt?.orNumber === orNumber)
    : undefined;
  const receipt = (byResourceId ?? byOrNumber)?.officialReceipt;

  return receipt?.status === "issued" && receipt.documentDataUrl ? receipt : undefined;
}
