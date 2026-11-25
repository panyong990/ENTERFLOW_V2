import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { getAccountingInvoice, getAccountingPayment, listAccountingInvoices, listAccountingPayments, type AccountingInvoice, type AccountingPayment } from '../api/accounting';
import { documentWorkflowApi, type PaymentProofQueueRow } from '../api/documentWorkflows';
import type { Invoice } from './Accounting';

export function accountingMoney(value: string | number | null | undefined) {
  // Preserve backend decimal strings, including their precision. Missing is never zero.
  if (value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) return '—';
  return `₱${value}`;
}

export function accountingInvoiceRow(invoice: AccountingInvoice, payments: AccountingPayment[]): Invoice {
  const records = payments.filter(payment => payment.invoiceId === invoice.id && payment.orderId === invoice.orderId);
  const types = [...new Set(records.map(payment => payment.paymentType).filter((value): value is string => Boolean(value)))];
  return {
    id: invoice.id, date: invoice.issuedOn ?? '', inv: invoice.reference,
    po: '—', client: invoice.companyName, item: '—', amount: Number(invoice.amount),
    payment: invoice.paymentTermCode ?? 'Unavailable',
    paymentType: types.length === 1 ? types[0].replaceAll('_', ' ') : types.length > 1 ? 'Payment history' : 'Payment proof submitted',
    status: 'unavailable', fulfillmentCompleted: null, downpaymentPercent: Number.NaN,
    dueDate: invoice.dueOn ?? undefined,
    // The legacy model uses numbers. NaN marks unavailable fields; Real rendering
    // reads the original decimal strings below and never runs Demo calculations.
    paymentState: {
      invoiceTotal: Number(invoice.amount), requiredDownpaymentAmount: Number(invoice.requiredDownpayment),
      totalVerifiedPayments: Number(invoice.verifiedAmount),
      verifiedDownpaymentAmount: Number.NaN, remainingDownpayment: Number.NaN,
      remainingInvoiceBalance: Number.NaN, downpaymentStatus: 'UNAVAILABLE',
      currentPaymentType: null, state: 'UNAVAILABLE',
    },
    paymentRecords: records.map(payment => ({
      id: payment.id, invoiceNo: invoice.reference, paymentType: payment.paymentType ?? 'PAYMENT_PROOF',
      submittedAmount: Number(payment.submittedAmount),
      verifiedAmount: payment.verifiedAmount == null ? undefined : Number(payment.verifiedAmount),
      method: payment.method ?? undefined, referenceNumber: payment.referenceNumber ?? undefined,
      paymentDate: payment.paidOn ?? '', verificationStatus: payment.verificationStatus,
      verifiedAt: payment.verificationStatus === 'verified' ? payment.reviewedAt ?? undefined : undefined,
      rejectedAt: payment.verificationStatus === 'rejected' ? payment.reviewedAt ?? undefined : undefined,
      rejectionReason: payment.rejectionReason ?? undefined,
      receiptDataUrl: payment.proofFileId ? documentWorkflowApi.paymentProofUrl(payment.proofFileId, payment.id) : undefined,
    })),
    backend: { invoice, payments: records },
  };
}

function failureMessage(cause: unknown) {
  return cause instanceof ApiError ? cause.message : 'Accounting records are unavailable.';
}

export async function loadAccountingRecords(signal: AbortSignal) {
  const [invoices, listedPayments, proofs] = await Promise.all([
    listAccountingInvoices(100, signal), listAccountingPayments(100, signal),
    documentWorkflowApi.paymentProofQueue(signal).then(rows => ({ rows, error: '' }))
      .catch(cause => ({ rows: [] as PaymentProofQueueRow[], error: failureMessage(cause) })),
  ]);
  // Proofs and payments can reference invoices outside the bounded invoice list.
  const missingPayments = proofs.rows.filter(proof => !listedPayments.some(payment => payment.id === proof.id));
  const payments = [...listedPayments, ...await Promise.all(missingPayments.map(proof => getAccountingPayment(proof.id, signal)))];
  const missingInvoiceIds = [...new Set(payments.map(payment => payment.invoiceId))].filter(id => !invoices.some(invoice => invoice.id === id));
  const allInvoices = [...invoices, ...await Promise.all(missingInvoiceIds.map(id => getAccountingInvoice(id, signal)))];
  return { invoices: allInvoices, payments, proofs: proofs.rows, proofError: proofs.error };
}

export function useRealAccounting(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadAccountingRecords>> | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [version, setVersion] = useState(0);
  const actionLock = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);
  const refresh = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    setSnapshot(null); setError(''); setReviewError('');
    setLoading(enabled);
    if (enabled) void loadAccountingRecords(controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setSnapshot(result); setUncertain(false); actionLock.current = false;
      })
      .catch(cause => { if (!controller.signal.aborted) setError(failureMessage(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [enabled, version]);

  const reviewPayment = async (id: string, decision: 'verify' | 'reject', reason = '') => {
    const proof = snapshot?.proofs.find(row => row.id === id && row.verificationStatus === 'pending');
    const controller = lifecycle.current;
    if (!enabled || !controller || controller.signal.aborted || loading || error || uncertain || actionLock.current || !proof || (decision === 'reject' && !reason.trim())) return false;
    actionLock.current = true; setBusy(true); setReviewError('');
    try {
      if (decision === 'verify') await documentWorkflowApi.verifyPayment(id, controller.signal);
      else await documentWorkflowApi.rejectPayment(id, reason.trim(), controller.signal);
      if (controller.signal.aborted) return false;
      // Only a fresh read can confirm amounts and status after the server decision.
      setUncertain(true); refresh();
      return true;
    } catch (cause) {
      if (!controller.signal.aborted) {
        setUncertain(true); setReviewError(`${failureMessage(cause)} Refresh records before another review.`);
      }
      return false;
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const rows = useMemo(() => enabled && snapshot ? snapshot.invoices.map(invoice => accountingInvoiceRow(invoice, snapshot.payments)) : [], [enabled, snapshot]);
  const canReview = (id: string) => enabled && !loading && !error && !busy && !uncertain && Boolean(snapshot?.proofs.some(proof => proof.id === id && proof.verificationStatus === 'pending'));
  return { rows, loading, error, reviewError, proofError: snapshot?.proofError ?? '', busy, refresh, reviewPayment, canReview };
}
