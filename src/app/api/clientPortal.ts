import { api, queryString } from "./client";

export interface ClientProfile {
  id: string; companyName: string; industry: string | null; contactPerson: string | null;
  email: string | null; phone: string | null; addressLine1: string | null; addressLine2: string | null;
  cityProvince: string | null; postalCode: string | null; paymentTermCode: string | null;
  paymentTermLabel: string | null; active: boolean; joinedOn: string | null;
}

export interface ClientOrder {
  archiveReason?: "rejected" | "cancelled" | null; archiveNote?: string | null; archivedAt?: string | null;
  id: string; reference: string; stageLabel: string | null; paymentTermLabel: string | null;
  deliveryMethodLabel: string | null; submittedAt: string | null; requestedDeliveryDate: string | null;
  fulfillmentCompletedAt: string | null; updatedAt: string | null; itemCount: number;
}

export interface ClientOrderItem { id: string; lineNumber: number; quantity: string | number; specificationId: string; [key: string]: unknown }
export interface ClientOrderDetail extends ClientOrder { items: ClientOrderItem[] }
export interface ClientQuotationLine { id: string; quotationId: string; lineNumber: number; description: string; subDescription: string | null; quantity: string | number; unitLabel: string | null; unitPrice: string }
export interface ClientQuotation { id: string; reference: string; revisionNumber: number; status: "sent" | "superseded"; issuedOn: string | null; validUntil: string | null; paymentTermLabel: string | null; timeOfDelivery: string | null; placeOfDelivery: string | null; totalAmount: string; downpaymentPercent: string | number; downpaymentAmount: string; sentAt: string | null; lines: ClientQuotationLine[] }
export interface ClientPurchaseOrder { id: string; acceptedQuotationId: string | null; acceptedQuotationReference: string | null; reference: string; clientReference: string | null; uploadedAt: string | null; receivedAt: string | null; clearedAt: string | null }
export interface ClientJobOrder { id: string; reference: string; quantity: number; productionDueDate: string; status?: string; productionStageLabel: string | null; completedAt: string | null; completed: boolean }
export interface ClientShipment { id: string; orderId: string; jobOrderId: string; deliveryMethodLabel: string; status?: string; trackingReference: string | null; estimatedDeliveryDate: string | null; expectedPickupDate: string | null; dispatchedAt?: string | null; deliveredAt?: string | null }
export interface ClientInvoice { id: string; reference: string; issuedOn: string; dueOn: string | null; paymentTermLabel: string; amount: string; requiredDownpayment: string; paymentCycleStartedAt: string | null; sentAt: string }
export interface ClientPayment { id: string; invoiceId: string | null; paymentType: string; submittedAmount: string; verifiedAmount: string | null; method: string | null; referenceNumber: string | null; paidOn: string; verificationStatus: string; submittedAt: string }
export interface ClientNotification { id: string; category: string; title: string; message: string; type: string | null; orderId: string | null; clientId: string | null; createdAt: string; readAt: string | null; isRead: boolean }
export interface ClientDashboard { activeOrders: number; pendingInquiries: number; sentQuotations: number; openInvoices: number; recentOrderActivity: Pick<ClientOrder, "id" | "reference" | "stageLabel" | "updatedAt" | "submittedAt">[]; upcomingDeliveries: ClientShipment[] }
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }

function withQuery(path: string, values: Record<string, string | number | undefined>) {
  const present = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Record<string, string | number>;
  const suffix = queryString(present);
  return suffix ? `${path}?${suffix}` : path;
}

export const clientPortalApi = {
  profile: (signal?: AbortSignal) => api<ClientProfile>("/api/client/profile", { signal }),
  dashboard: (signal?: AbortSignal) => api<ClientDashboard>("/api/client/dashboard", { signal }),
  orders: (params: { page?: number; pageSize?: number; q?: string; status?: string; stage?: string; sort?: string } = {}, signal?: AbortSignal) => api<Page<ClientOrder>>(withQuery("/api/client/orders", params), { signal }),
  order: (id: string, signal?: AbortSignal) => api<ClientOrderDetail>(`/api/client/orders/${encodeURIComponent(id)}`, { signal }),
  quotations: (id: string, signal?: AbortSignal) => api<ClientQuotation[]>(`/api/client/orders/${encodeURIComponent(id)}/quotations`, { signal }),
  purchaseOrder: (id: string, signal?: AbortSignal) => api<ClientPurchaseOrder | null>(`/api/client/orders/${encodeURIComponent(id)}/purchase-order`, { signal }),
  jobOrders: (id: string, signal?: AbortSignal) => api<{ orderId: string; jobOrders: ClientJobOrder[] }>(`/api/client/orders/${encodeURIComponent(id)}/job-orders`, { signal }),
  delivery: (id: string, signal?: AbortSignal) => api<{ orderId: string; shipments: ClientShipment[] }>(`/api/client/orders/${encodeURIComponent(id)}/delivery`, { signal }),
  invoices: (id: string, signal?: AbortSignal) => api<ClientInvoice[]>(`/api/client/orders/${encodeURIComponent(id)}/invoices`, { signal }),
  payments: (id: string, signal?: AbortSignal) => api<ClientPayment[]>(`/api/client/orders/${encodeURIComponent(id)}/payments`, { signal }),
  notifications: (params: { page?: number; pageSize?: number; q?: string; status?: "all" | "read" | "unread"; sort?: "created-asc" | "created-desc" } = {}, signal?: AbortSignal) => api<Page<ClientNotification>>(withQuery("/api/client/notifications", params), { signal }),
  markNotificationRead: (id: string, signal?: AbortSignal) => api<{ notificationId: string; isRead: true }>(`/api/client/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", body: {}, signal }),
};
