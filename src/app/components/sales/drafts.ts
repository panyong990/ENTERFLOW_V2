import { toast } from "sonner";
import type { Inquiry } from "../../store/orders";
import type { SalesOrderDetail } from "../useSalesOrders";

export function pendingIntegration(operation: string) {
  const message = `${operation}: backend integration pending. No record was saved or sent.`;
  toast.info(message);
  window.dispatchEvent(new CustomEvent("enterflow:sales-pending", { detail: message }));
}

// A one-way presentation adapter for the original forms. Returned business
// documents remain separate, with their original decimal strings and IDs.
export function inquiryDraft(order: SalesOrderDetail): Inquiry {
  return {
    id: order.id, code: order.reference, clientName: order.companyName,
    contactPerson: order.contactPerson || "Unavailable", generalNotes: order.generalNotes || undefined,
    paymentTerms: order.paymentTermLabel as Inquiry["paymentTerms"],
    stage: order.stageCode as Inquiry["stage"], submittedDate: order.submittedAt,
    urgent: order.urgent, dueDate: order.requestedDeliveryDate || undefined,
    deliveryMethod: order.deliveryMethodLabel as Inquiry["deliveryMethod"] || undefined,
    products: order.items.map(item => ({ ...item, id: String(item.id), type: item.filterTypeCode || "Unspecified filter type", filterName: item.filterName || undefined, qty: item.quantity, oem: item.oemPartNumber || undefined })) as Inquiry["products"],
  };
}
