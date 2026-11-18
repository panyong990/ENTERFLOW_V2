import { api } from './client';

export interface PaymentProofQueueRow { id: string; orderId: string; invoiceId: string; fileId: string; orderReference: string; companyName: string; invoiceReference: string; submittedAmount: string; method: string | null; referenceNumber: string | null; rejectionReason: string | null; submittedAt: string; verificationStatus: 'pending' | 'verified' | 'rejected' }
export const documentWorkflowApi = {
  paymentProofQueue: (signal?: AbortSignal) => api<PaymentProofQueueRow[]>('/api/documents/accounting/payment-proof-queue', { signal }),
  verifyPayment: (id: string, signal?: AbortSignal) => api<{ paymentId: string; verificationStatus: string }>(`/api/documents/accounting/payments/${encodeURIComponent(id)}/verify`, { method: 'POST', body: {}, signal }),
  rejectPayment: (id: string, reason: string, signal?: AbortSignal) => api<{ paymentId: string; verificationStatus: string }>(`/api/documents/accounting/payments/${encodeURIComponent(id)}/reject`, { method: 'POST', body: { reason }, signal }),
  paymentProofUrl: (fileId: string, paymentId: string) => `/api/documents/accounting/payment-files/${encodeURIComponent(fileId)}?paymentId=${encodeURIComponent(paymentId)}`
};
