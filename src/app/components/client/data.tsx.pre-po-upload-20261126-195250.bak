import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { clientPortalApi, type ClientProfile, type ClientNotification, type ClientInquiryInput, type ClientInquiryCreated, type ClientQuotationDecision, type InquirySketchInput } from '../../api/clientPortal';
import type { Inquiry } from './model';
import { project, type OrderBundle, type Surface } from './adapters';

export const unavailableMessage = 'This feature is not yet connected to the backend. Your draft has not been submitted.';
export function unavailable(..._args: unknown[]) { toast.info(unavailableMessage); return false; }
const blocked = (..._args: unknown[]): never => { throw new Error(unavailableMessage); };
export type State = { profile: ClientProfile | null; bundles: OrderBundle[]; notifications: ClientNotification[]; loading: boolean; error: string; refresh: () => void; markRead: (id: string) => Promise<void>; realMode: true };
const Context = createContext<State | null>(null);
export function useOptionalClientData() { return useContext(Context); }
export function useClientData() { const data = useContext(Context); if (!data) throw new Error('Client data provider required'); return data; }
async function allPages<T>(read: (page: number) => Promise<{ items: T[]; total: number; page: number; pageSize: number }>, signal: AbortSignal) {
  const items: T[] = [];
  for (let page = 1; !signal.aborted; page++) {
    const result = await read(page);
    items.push(...result.items);
    if (items.length >= result.total) return items;
    if (!result.items.length || result.page !== page) throw new Error('The service returned an incomplete page. Refresh to retry.');
  }
  throw new Error('Request cancelled');
}
export function ClientDataProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [bundles, setBundles] = useState<OrderBundle[]>([]);
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(), signal = controller.signal;
    setLoading(true); setError(''); setBundles([]); setNotifications([]);
    const load = async () => {
      const nextProfile = await clientPortalApi.profile(signal);
      if (signal.aborted) return;
      setProfile(nextProfile);
      const [ordersResult, notificationsResult] = await Promise.allSettled([
        allPages(page => clientPortalApi.orders({ page, pageSize: 100, status: 'all', sort: 'submitted-desc' }, signal), signal),
        allPages(page => clientPortalApi.notifications({ page, pageSize: 100, status: 'all', sort: 'created-desc' }, signal), signal),
      ]);
      if (signal.aborted) return;
      const errors: string[] = [];
      if (notificationsResult.status === 'fulfilled') setNotifications(notificationsResult.value);
      else errors.push(`Notifications: ${notificationsResult.reason.message}`);
      if (ordersResult.status === 'rejected') { setError([...errors, `Orders: ${ordersResult.reason.message}`].join(' ')); return; }
      const loaded: OrderBundle[] = [];
      // Bound fan-out; keep every child collection and each endpoint's failure separate.
      for (let start = 0; start < ordersResult.value.length && !signal.aborted; start += 4) {
        loaded.push(...await Promise.all(ordersResult.value.slice(start, start + 4).map(async row => {
          const calls = [clientPortalApi.order(row.id, signal), clientPortalApi.quotations(row.id, signal), clientPortalApi.purchaseOrder(row.id, signal), clientPortalApi.jobOrders(row.id, signal), clientPortalApi.delivery(row.id, signal), clientPortalApi.invoices(row.id, signal), clientPortalApi.payments(row.id, signal)];
          const values = await Promise.allSettled(calls);
          const labels = ['Specifications', 'Quotations', 'Purchase order', 'Job orders', 'Delivery', 'Invoices', 'Payments'];
          const errors = values.flatMap((value, i) => value.status === 'rejected' ? [`${labels[i]}: ${value.reason.message}`] : []);
          const value = (i: number, fallback: unknown) => values[i].status === 'fulfilled' ? (values[i] as PromiseFulfilledResult<unknown>).value : fallback;
          return { order: value(0, { ...row, items: [] }), quotations: value(1, []), purchaseOrder: value(2, null), jobOrders: (value(3, { jobOrders: [] }) as {jobOrders: unknown[]}).jobOrders, shipments: (value(4, { shipments: [] }) as {shipments: unknown[]}).shipments, invoices: value(5, []), payments: value(6, []), errors } as OrderBundle;
        })));
      }
      if (!signal.aborted) { setBundles(loaded); setError([...errors, ...loaded.flatMap(b => b.errors.map(e => `${b.order.reference}: ${e}`))].join(' ')); }
    };
    void load().catch(cause => { if (!signal.aborted) setError(cause.message ?? 'Client data unavailable.'); }).finally(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  const markRead = async (id: string) => {
    try {
      await clientPortalApi.markNotificationRead(id);
      setNotifications(current => current.map(item => item.id === id ? { ...item, isRead: true } : item));
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Notification update failed.'); }
  };
  return <Context.Provider value={{ profile, bundles, notifications, loading, error, refresh: () => setRevision(v => v + 1), markRead, realMode: true }}>{children}</Context.Provider>;
}
export function useOrders(surface: Surface = 'orders') {
  return useOrderAdapter(useClientData(), surface);
}
export function useOrderAdapter({ profile, bundles, refresh }: State, surface: Surface = 'orders') {
  const rows = useMemo(() => profile ? bundles.flatMap(bundle => project(bundle, profile, surface)) : [], [profile, bundles, surface]);
  const addInquiry = async (input: ClientInquiryInput, sketches: InquirySketchInput[] = [], key?: string): Promise<ClientInquiryCreated> => {
    const created = sketches.length
      ? await clientPortalApi.createInquiryWithSketches(input, sketches, key!)
      : await clientPortalApi.createInquiry(input, undefined, key);
    refresh();
    window.dispatchEvent(new Event('enterflow:client-inquiry-submitted'));
    return created;
  };
  const decideQuotation = async (orderId: string, quotationId: string, input: ClientQuotationDecision) => {
    const result = await clientPortalApi.decideQuotation(orderId, quotationId, input);
    refresh();
    return result;
  };
  const submitPurchaseOrder = async (orderId: string, reference: string, file?: File, deliveryMethodId?: string) => {
    const quotations = bundles.find(bundle => bundle.order.id === orderId)?.quotations;
    const quotation = quotations?.find(quote => quote.isLatestRevision && (quote.decision === 'accepted' || quote.status === 'accepted'));
    if (!file || !deliveryMethodId || !quotation) throw new Error('An accepted current quotation, delivery method and PO document are required.');
    const result = await clientPortalApi.uploadPurchaseOrderDocument(orderId, { reference, file, deliveryMethodId, quotationId: quotation.id });
    refresh();
    return result;
  };
  const requestQuotationRevision = async (orderId: string, reason: string) => {
    const quotationId = bundles.find(bundle => bundle.order.id === orderId)?.quotations.find(quote => quote.isLatestRevision)?.id;
    if (!quotationId) throw new Error('Reload the current quotation before requesting a revision.');
    const result = await clientPortalApi.requestQuotationRevision(orderId, { reason, quotationId });
    refresh();
    return result;
  };
  const requestCancellation = async (orderId: string, input: { reason: string; termsAcknowledged: boolean }) => {
    if (!input.termsAcknowledged) throw new Error('Acknowledge the cancellation terms before submitting.');
    const result = await clientPortalApi.requestCancellation(orderId, { reason: input.reason, termsAcknowledged: true });
    refresh();
    return result;
  };
  const submitPayment = async (orderId: string, invoiceId: string, input: { amount: string | number; method?: string; referenceNumber?: string; file: File }) => {
    const result = await clientPortalApi.uploadPaymentProof(orderId, { invoiceId, ...input });
    refresh();
    return result;
  };
  return useMemo(() => ({ inquiries: rows, completedJOs: rows.filter(row => !!row.joNumber), byClient: (_name: string) => rows,
    decideQuotation, submitPurchaseOrder, requestQuotationRevision, requestCancellation,
    addInquiry, addInquiryWithProductSketches: addInquiry, uploadPO: blocked, updateInquiry: blocked, submitPayment,
    generatePONumber: () => 'Assigned by backend on submission', savePendingSignedDeliveryReceipt: blocked, submitPendingSignedDeliveryReceipt: blocked, discardPendingSignedDeliveryReceipt: blocked,
  }), [rows, addInquiry, decideQuotation, submitPurchaseOrder, requestQuotationRevision, requestCancellation, submitPayment]);
}
export function useSettings() {
  return { settings: { bankDetails: { bankName: 'Unavailable — not provided by the Client API', accountName: '—', accountNumber: '—' }, paymentMethods: [] as {id: string; label: string; type: string; details: string}[] } };
}
export async function loadProductSketchAttachment(..._args: unknown[]) { return null as { fileName: string; dataUrl: string } | null; }
// File reading prepares a transient draft only. It never opens the Demo IndexedDB.
export { readFileAsDataUrl } from '../../store/attachments';
export type Department = string;
export function notificationStyle(dept: string) {
  return ({ sales: { color: '#C8102E', bg: '#FEE2E2', label: 'Sales' }, production: { color: '#1A2B4A', bg: '#DBEAFE', label: 'Production' }, logistics: { color: '#C9A84C', bg: '#FEF3C7', label: 'Logistics' }, payments: { color: '#16A34A', bg: '#DCFCE7', label: 'Payments' }, system: { color: '#475569', bg: '#E2E8F0', label: 'System' } } as Record<string, {color: string; bg: string; label: string}>)[dept] ?? { label: dept || 'System', bg: '#E2E8F0', color: '#475569' };
}
export function notificationDestination(n: { inquiryId?: string; dept?: string }, _role?: string) { return n.inquiryId ? 'orders' : 'notifications'; }
export function canNavigateToNotification(role: string, route: string) { return role === 'client' && ['orders', 'status', 'logistics', 'accounting', 'settings', 'notifications'].includes(route); }
export function isOfficialReceiptNotification(n: { title: string; body: string }) { return /official receipt/i.test(n.title + n.body); }
export function findReceiptForNotification(..._args: unknown[]): Inquiry['officialReceipt'] | undefined { return undefined; }
export function useNotifications() {
  return useNotificationAdapter(useClientData());
}
export function useNotificationAdapter({ notifications, markRead }: State) {
  const rows = notifications.map(n => ({ ...n, dept: n.category, body: n.message, read: n.isRead, inquiryId: n.orderId ?? undefined, ts: n.createdAt, time: new Date(n.createdAt).toLocaleString() }));
  return { unreadFor: (..._args: unknown[]) => rows, isReadFor: (n: {read: boolean}, ..._args: unknown[]) => n.read,
    markRead: (id: string, ..._args: unknown[]) => markRead(id), markAllRead: unavailable, remove: unavailable, removeAllRead: unavailable, push: blocked };
}
