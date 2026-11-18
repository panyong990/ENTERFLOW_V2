import { api } from './client';

export interface AccountingInvoice {
  id: string;
  orderId: string;
  orderReference: string;
  companyName: string;
  reference: string;
  issuedOn: string | null;
  amount: string;
  requiredDownpayment: string;
  paymentTermCode: string | null;
  dueOn: string | null;
  sentAt: string | null;
  verifiedAmount: string;
}

export interface AccountingPayment {
  id: string;
  orderId: string;
  invoiceId: string;
  paymentType: string;
  submittedAmount: string;
  verifiedAmount: string | null;
  method: string | null;
  referenceNumber: string | null;
  rejectionReason: string | null;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  paidOn: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  proofFileId: string | null;
}

export function listAccountingInvoices(limit = 100, signal?: AbortSignal) {
  return api<AccountingInvoice[]>(`/api/accounting/invoices?limit=${limit}`, { signal });
}

export function getAccountingInvoice(id: string, signal?: AbortSignal) {
  return api<AccountingInvoice>(`/api/accounting/invoices/${encodeURIComponent(id)}`, { signal });
}

export function listAccountingPayments(limit = 100, signal?: AbortSignal) {
  return api<AccountingPayment[]>(`/api/accounting/payments?limit=${limit}`, { signal });
}

export function getAccountingPayment(id: string, signal?: AbortSignal) {
  return api<AccountingPayment>(`/api/accounting/payments/${encodeURIComponent(id)}`, { signal });
}
